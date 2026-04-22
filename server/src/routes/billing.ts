import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import prisma from '../lib/prisma';

const router = Router();

// Initialize Stripe (apiVersion: SDK types may lag behind Stripe's latest; cast to satisfy type)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia' as '2023-10-16',
});

/**
 * Resolve user + company for billing: prefers `companyContext` (X-Test-User-Email / session),
 * falls back to legacy dev user `test@procuroapp.com`.
 */
async function getBillingContext(req: Request) {
  const companyId = req.companyId;
  const contextUser = req.companyContextUser;
  if (companyId != null && contextUser) {
    const user = await prisma.user.findUnique({
      where: { id: contextUser.id },
      include: { company: true },
    });
    if (user?.company) return { user, company: user.company };
  }
  const user = await prisma.user.findFirst({
    where: { email: 'test@procuroapp.com' },
    include: { company: true },
  });
  return user?.company ? { user, company: user.company } : null;
}

/**
 * POST /api/billing/create-checkout-session
 * Create a Stripe Checkout session for subscription
 */
router.post('/create-checkout-session', async (req: Request, res: Response) => {
  try {
    const ctx = await getBillingContext(req);
    if (!ctx) {
      return res.status(404).json({ error: 'User or company not found' });
    }
    const { user, company } = ctx;

    // Get price ID from environment
    const priceId = process.env.STRIPE_PRICE_ID_MONTHLY;
    if (!priceId) {
      return res.status(500).json({ error: 'Stripe price ID not configured' });
    }

    // Create or retrieve Stripe customer
    let customerId = company.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: company.name || undefined,
        metadata: {
          companyId: company.id.toString(),
          realmId: company.realmId ?? '',
        },
      });
      customerId = customer.id;

      // Save customer ID to company
      await prisma.company.update({
        where: { id: company.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/?canceled=true`,
      metadata: {
        companyId: company.id.toString(),
      },
    });

    res.json({
      success: true,
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({
      error: 'Failed to create checkout session',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/billing/checkout-success?session_id=cs_xxx
 * Called by frontend after Stripe Checkout redirect. Updates company subscription
 * from the session so local testing works without webhooks.
 */
router.get('/checkout-success', async (req: Request, res: Response) => {
  try {
    const sessionId = (req.query.session_id as string)?.trim();
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing session_id' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    if (session.status !== 'complete' || session.payment_status !== 'paid') {
      return res.status(400).json({
        error: 'Session not paid',
        status: session.status,
        payment_status: session.payment_status,
      });
    }

    const companyId = session.metadata?.companyId;
    const subscriptionId =
      typeof session.subscription === 'object' && session.subscription != null
        ? (session.subscription as Stripe.Subscription).id
        : (session.subscription as string) || null;

    if (!companyId) {
      return res.status(400).json({ error: 'Session has no companyId' });
    }

    await prisma.company.update({
      where: { id: parseInt(companyId, 10) },
      data: {
        isSubscribed: true,
        stripeSubscriptionId: subscriptionId,
      },
    });

    console.log(`✅ Checkout success: company ${companyId} isSubscribed = true`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error in checkout-success:', error);
    res.status(500).json({
      error: 'Failed to confirm checkout',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

const TRIAL_DAYS = 14;

/**
 * POST /api/billing/start-trial
 * Creates Stripe customer if missing, then a Checkout session in setup mode
 * to collect payment method without charging. Trial dates set on confirm.
 */
router.post('/start-trial', async (req: Request, res: Response) => {
  try {
    const ctx = await getBillingContext(req);
    if (!ctx) {
      return res.status(404).json({ error: 'User or company not found' });
    }
    const { user, company } = ctx;

    let customerId = company.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: company.name || undefined,
        metadata: {
          companyId: company.id.toString(),
          realmId: company.realmId ?? '',
        },
      });
      customerId = customer.id;
      await prisma.company.update({
        where: { id: company.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'setup',
      payment_method_types: ['card'],
      success_url: `${frontendUrl}/activate?setup=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/activate?canceled=1`,
      metadata: {
        companyId: company.id.toString(),
        purpose: 'trial_setup',
      },
    });

    res.json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error('Error starting trial:', error);
    res.status(500).json({
      error: 'Failed to start trial',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/billing/confirm-setup
 * Called after Stripe Checkout setup mode completes. Sets paymentMethodAddedAt,
 * trialStartedAt, trialEndsAt on company.
 */
router.post('/confirm-setup', async (req: Request, res: Response) => {
  try {
    const { session_id: sessionId } = req.body as { session_id?: string };
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'Missing session_id' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.mode !== 'setup' || session.status !== 'complete') {
      return res.status(400).json({
        error: 'Invalid setup session',
        mode: session.mode,
        status: session.status,
      });
    }

    const companyId = session.metadata?.companyId;
    if (!companyId) {
      return res.status(400).json({ error: 'Session has no companyId' });
    }

    const now = new Date();
    const trialEndsAt = new Date(now);
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

    await prisma.company.update({
      where: { id: parseInt(companyId, 10) },
      data: {
        paymentMethodAddedAt: now,
        trialStartedAt: now,
        trialEndsAt,
      },
    });

    console.log(`✅ Setup confirmed: company ${companyId} trial started, ends ${trialEndsAt.toISOString()}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error confirming setup:', error);
    res.status(500).json({
      error: 'Failed to confirm setup',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/billing/create-portal-session
 * Create a Stripe Customer Portal session
 */
router.post('/create-portal-session', async (req: Request, res: Response) => {
  try {
    const ctx = await getBillingContext(req);
    if (!ctx) {
      return res.status(404).json({ error: 'User or company not found' });
    }
    const { company } = ctx;

    if (!company.stripeCustomerId) {
      return res.status(404).json({ error: 'Company or Stripe customer not found' });
    }

    // Create portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: company.stripeCustomerId,
      return_url: process.env.STRIPE_BILLING_PORTAL_RETURN_URL || 'http://localhost:5173/settings',
    });

    res.json({
      success: true,
      url: portalSession.url,
    });
  } catch (error) {
    console.error('Error creating portal session:', error);
    res.status(500).json({
      error: 'Failed to create portal session',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/billing/webhook
 * Handle Stripe webhook events
 * Note: This route uses raw body (handled in index.ts middleware)
 */
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    return res.status(400).send('Missing stripe-signature header');
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).send('Webhook secret not configured');
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  try {
    // Handle the event
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Find company by Stripe customer ID
        const company = await prisma.company.findFirst({
          where: { stripeCustomerId: customerId },
        });

        if (company) {
          await prisma.company.update({
            where: { id: company.id },
            data: {
              isSubscribed: subscription.status === 'active' || subscription.status === 'trialing',
              stripeSubscriptionId: subscription.id,
            },
          });
          console.log(`✅ Updated subscription for company ${company.id}: ${subscription.status}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Find company by Stripe customer ID
        const company = await prisma.company.findFirst({
          where: { stripeCustomerId: customerId },
        });

        if (company) {
          await prisma.company.update({
            where: { id: company.id },
            data: {
              isSubscribed: false,
              stripeSubscriptionId: null,
            },
          });
          console.log(`✅ Subscription updated: company.isSubscribed = false | Source: Stripe Webhook`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        // Find company by Stripe customer ID
        const company = await prisma.company.findFirst({
          where: { stripeCustomerId: customerId },
        });

        if (company) {
          // Optionally set isSubscribed to false on payment failure
          // Or keep it true and handle grace period
          await prisma.company.update({
            where: { id: company.id },
            data: {
              isSubscribed: false, // Disable on payment failure
            },
          });
          console.log(`✅ Subscription updated: company.isSubscribed = false | Source: Stripe Webhook (Payment Failed)`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({
      error: 'Webhook handler failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/billing/subscription-status
 * Get current subscription status for the user's company
 */
router.get('/subscription-status', async (req: Request, res: Response) => {
  try {
    const ctx = await getBillingContext(req);
    if (!ctx) {
      return res.status(404).json({ error: 'User or company not found' });
    }
    const { company } = ctx;

    res.json({
      success: true,
      isSubscribed: company?.isSubscribed || false,
      hasStripeCustomer: !!company?.stripeCustomerId,
      stripeCustomerId: company?.stripeCustomerId || null,
    });
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    res.status(500).json({
      error: 'Failed to fetch subscription status',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

