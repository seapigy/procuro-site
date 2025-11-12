import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../lib/prisma';

const router = Router();

/**
 * POST /api/company/invite
 * Generate a secure invite link for a company
 */
router.post('/company/invite', async (req: Request, res: Response) => {
  try {
    const { userId, companyId } = req.body;

    // Validate input
    if (!userId && !companyId) {
      return res.status(400).json({ 
        error: 'Either userId or companyId is required' 
      });
    }

    // Get company (either directly or via user)
    let company;
    if (companyId) {
      company = await prisma.company.findUnique({
        where: { id: companyId },
      });
    } else if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { company: true },
      });
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      if (!user.companyId || !user.company) {
        return res.status(400).json({ 
          error: 'User is not associated with a company' 
        });
      }
      
      company = user.company;
    }

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check for existing valid invites
    const existingInvite = await prisma.invite.findFirst({
      where: {
        companyId: company.id,
        used: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        expiresAt: 'desc',
      },
    });

    // If valid invite exists, reuse it
    if (existingInvite) {
      const inviteUrl = `${process.env.APP_URL || 'http://localhost:5173'}/invite/${existingInvite.token}`;
      
      return res.json({
        inviteUrl,
        token: existingInvite.token,
        expiresAt: existingInvite.expiresAt,
        reused: true,
      });
    }

    // Generate secure token (32 bytes = 64 hex characters)
    const token = crypto.randomBytes(32).toString('hex');

    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create invite
    const invite = await prisma.invite.create({
      data: {
        companyId: company.id,
        token,
        expiresAt,
      },
    });

    const inviteUrl = `${process.env.APP_URL || 'http://localhost:5173'}/invite/${invite.token}`;

    console.log(`✅ Created invite for ${company.name} - expires ${expiresAt.toLocaleDateString()}`);

    res.json({
      inviteUrl,
      token: invite.token,
      expiresAt: invite.expiresAt,
      companyName: company.name,
      reused: false,
    });
  } catch (error) {
    console.error('Error generating invite:', error);
    res.status(500).json({ 
      error: 'Failed to generate invite link',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/invite/:token
 * Validate and retrieve invite information
 */
router.get('/invite/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    // Find invite
    const invite = await prisma.invite.findUnique({
      where: { token },
      include: {
        company: true,
      },
    });

    if (!invite) {
      return res.status(404).json({ 
        error: 'Invite not found',
        message: 'This invite link is invalid or has been deleted.'
      });
    }

    // Check if already used
    if (invite.used) {
      return res.status(410).json({ 
        error: 'Invite already used',
        message: 'This invite link has already been used. Request a new invite from your team administrator.'
      });
    }

    // Check if expired
    if (new Date() > invite.expiresAt) {
      return res.status(410).json({ 
        error: 'Invite expired',
        message: 'This invite link has expired. Request a new invite from your team administrator.',
        expiredAt: invite.expiresAt
      });
    }

    // Return valid invite info
    res.json({
      valid: true,
      companyName: invite.company.name,
      companyId: invite.company.id,
      expiresAt: invite.expiresAt,
      token: invite.token,
    });
  } catch (error) {
    console.error('Error validating invite:', error);
    res.status(500).json({ 
      error: 'Failed to validate invite',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/invite/:token/accept
 * Mark invite as used (internal use by OAuth callback)
 */
router.post('/invite/:token/accept', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { userId } = req.body;

    const invite = await prisma.invite.findUnique({
      where: { token },
      include: { company: true },
    });

    if (!invite || invite.used || new Date() > invite.expiresAt) {
      return res.status(400).json({ error: 'Invalid or expired invite' });
    }

    // Mark invite as used
    await prisma.invite.update({
      where: { id: invite.id },
      data: { used: true },
    });

    console.log(`✅ Invite used: ${invite.company.name} - User ${userId}`);

    res.json({
      success: true,
      companyId: invite.companyId,
      companyName: invite.company.name,
    });
  } catch (error) {
    console.error('Error accepting invite:', error);
    res.status(500).json({ 
      error: 'Failed to accept invite',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

