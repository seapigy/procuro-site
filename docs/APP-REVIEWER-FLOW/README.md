# 🧪 QUICKBOOKS REVIEWER TEST FLOW PACKAGE

**Version:** 1.1.0  
**Date:** November 13, 2025  
**Status:** Complete & Ready for Submission

---

## 📋 OVERVIEW

This directory contains the complete testing package for Intuit QuickBooks App Store reviewers. Everything needed to test, validate, and approve the Procuro app is included.

---

## 📂 PACKAGE CONTENTS

### 1. **REVIEWER-TEST-FLOW.md** (Main Guide)
The primary testing document with 12 sections:
- App Overview
- Reviewer Preparation
- OAuth Flow Test
- Dashboard Test
- Items Page Test (with inline editing & search)
- Alerts Test
- Reports Test (with Top Vendors chart)
- Settings Test (with auto-check & backup)
- Cron Worker Test
- Failure Mode Testing
- Security Overview
- Reviewer Cheat Sheet (TL;DR)

**Use:** Start here for complete step-by-step testing instructions.

---

### 2. **CHECKLIST.md** (Printable Checklist)
A comprehensive checklist with ✓ boxes for reviewers to track:
- Pre-flight preparation
- Public pages verification
- OAuth flow test
- Dashboard test
- Items page test
- Alerts page test
- Reports page test
- Settings page test
- Failure mode testing
- Security verification
- Final approval decision

**Use:** Print or keep open in separate window to track progress.

---

### 3. **SCREENSHOTS.md** (Visual Reference)
Descriptions and placeholders for 21 screenshots:
- OAuth flow (3 screenshots)
- Dashboard views (2 screenshots)
- Items page (5 screenshots)
- Alerts page (2 screenshots)
- Reports page (3 screenshots)
- Settings page (3 screenshots)
- Error/edge cases (3 screenshots)

**Use:** Reference for what reviewers should see at each step.

---

### 4. **EXPECTED-RESPONSES.md** (API Reference)
Complete API response documentation:
- Health check endpoint
- Items endpoints (GET, PATCH)
- Alerts endpoints (GET, POST, DELETE)
- Savings summary endpoint
- Backup endpoint
- Invite endpoints
- QuickBooks OAuth endpoints
- CSV export format
- manifest.json
- appstore-metadata.json
- Error responses (400, 401, 403, 404, 500)

**Use:** Validate API responses using browser DevTools Network tab.

---

### 5. **DEBUGGING.md** (Troubleshooting Guide)
Comprehensive troubleshooting for common issues:
- Quick fixes (90% of issues)
- OAuth issues (3 common scenarios)
- Dashboard issues (2 common scenarios)
- Items page issues (2 common scenarios)
- Alerts page issues (2 common scenarios)
- Reports page issues (2 common scenarios)
- Settings page issues (2 common scenarios)
- Network issues
- Security issues
- Nuclear options (complete reset)
- When to contact support
- How to report issues
- Developer Tools guide
- Debugging checklist
- Common misunderstandings

**Use:** Reference when encountering issues during testing.

---

## 🚀 QUICK START

### For Reviewers (10-Minute Quick Test):

1. **Read:** REVIEWER-TEST-FLOW.md → Section 12 (TL;DR)
2. **Print:** CHECKLIST.md (optional)
3. **Test:** Follow 6-step quick flow in Section 12
4. **Approve:** If all steps pass

### For Reviewers (Full 25-Minute Test):

1. **Read:** REVIEWER-TEST-FLOW.md → Sections 1-2
2. **Open:** CHECKLIST.md in separate window
3. **Test:** Follow Sections 3-11 sequentially
4. **Reference:** SCREENSHOTS.md and EXPECTED-RESPONSES.md as needed
5. **Troubleshoot:** Use DEBUGGING.md if issues arise
6. **Decide:** Complete approval decision in CHECKLIST.md

---

## 🎯 TESTING FLOW

```
START
  ↓
[Preparation] ← REVIEWER-TEST-FLOW.md Section 2
  ↓
[OAuth Test] ← Section 3
  ↓
[Dashboard Test] ← Section 4
  ↓
[Items Test] ← Section 5
  ↓
[Alerts Test] ← Section 6
  ↓
[Reports Test] ← Section 7
  ↓
[Settings Test] ← Section 8
  ↓
[Failure Modes] ← Section 10
  ↓
[Security Check] ← Section 11
  ↓
[Decision]
  ↓
APPROVE / REQUEST CHANGES / REJECT
```

---

## ✅ SUCCESS CRITERIA

For approval, all these must pass:

### Core Functionality (Critical)
- [ ] OAuth authorization completes without errors
- [ ] Dashboard loads inside QuickBooks iframe
- [ ] Items table displays with mock data
- [ ] Alerts list displays
- [ ] Reports charts render correctly
- [ ] Settings modal opens and saves preferences
- [ ] No critical JavaScript errors in console

### Optional Add-Ons (v1.1.0)
- [ ] Inline editing works (Items page)
- [ ] Quick search filters items (Items page)
- [ ] Top Vendors chart displays (Reports page)
- [ ] Auto-check toggle works (Settings)
- [ ] Database backup downloads (Settings)

### Public Pages
- [ ] Landing page loads (procuroapp.com)
- [ ] Privacy policy loads
- [ ] Terms of service loads
- [ ] Support page loads
- [ ] All pages use HTTPS

### Security
- [ ] Privacy policy mentions AES-256 encryption
- [ ] Privacy policy states "no data selling/sharing"
- [ ] Sensitive paths return 403 Forbidden (/server, /.env, /db)
- [ ] OAuth scopes are justified

---

## 📊 ESTIMATED TIMES

| Test Section | Quick Test | Full Test |
|--------------|-----------|-----------|
| Preparation | 2 min | 5 min |
| OAuth | 2 min | 5 min |
| Dashboard | 1 min | 3 min |
| Items | 1 min | 5 min |
| Alerts | 1 min | 3 min |
| Reports | 1 min | 3 min |
| Settings | 2 min | 5 min |
| Failure Modes | — | 3 min |
| Security | — | 2 min |
| **TOTAL** | **10 min** | **25 min** |

---

## 🆘 SUPPORT

### During Review

**Email:** procuroapp@gmail.com  
**Subject Format:** "QuickBooks Review - [Issue]"  
**Response Time:** Within 24 hours (weekdays)

### What to Include in Support Email

1. Issue description
2. Steps to reproduce
3. Expected vs actual behavior
4. Browser and OS version
5. Console errors (if any)
6. Screenshots (if helpful)

**See:** DEBUGGING.md → "How to Report Issues" for detailed format

---

## 📞 CONTACTS

**Developer:** Procuro Inc.  
**Website:** https://procuroapp.com  
**Support:** https://procuroapp.com/support  
**Email:** procuroapp@gmail.com  
**GitHub:** https://github.com/seapigy/procuro-site

---

## 📦 DELIVERABLES INCLUDED

This package includes:

- ✅ Step-by-step testing guide
- ✅ Printable checklist
- ✅ Visual reference (screenshots guide)
- ✅ API response documentation
- ✅ Comprehensive troubleshooting guide
- ✅ Quick start guide (this README)

---

## 🔄 DOCUMENT VERSIONS

All documents in this package are:
- **Version:** 1.1.0
- **Date:** November 13, 2025
- **Status:** Final / Ready for Submission
- **Aligned with:** Procuro v1.1.0 (SQLite build)

---

## 📝 NOTES FOR INTUIT TEAM

### Testing Environment
- Use QuickBooks Online Sandbox
- Chrome or Edge browser recommended
- Allocate 10-25 minutes for testing
- Mock data pre-loaded for convenience

### Known Limitations
- Cron jobs run at 2 AM / 3 AM (not visible during review)
- Alerts require mock data or actual price drops
- CSV export requires alerts data
- Backup is SQLite format (not Excel)

### What Makes This App Special
- **Embedded iframe** inside QuickBooks (seamless UX)
- **AES-256 encryption** for all OAuth tokens
- **No data selling/sharing** (privacy-first)
- **Optional add-ons** (v1.1.0): inline editing, quick search, enhanced charts
- **QuickBooks-style UI** (consistent with Intuit design language)

---

## 🎓 REVIEWER TRAINING

If this is your first time reviewing Procuro:

1. **Read:** REVIEWER-TEST-FLOW.md → Sections 1-2 (10 min)
2. **Skim:** SCREENSHOTS.md (5 min)
3. **Bookmark:** DEBUGGING.md (for reference)
4. **Perform:** Quick Test (10 min)
5. **Decide:** Approve or request changes

**Total time:** ~30 minutes

---

## ✨ THANK YOU

We appreciate the Intuit review team's time and thoroughness. Our goal is to help QuickBooks users save money effortlessly, and we're excited to bring this value to the QuickBooks community.

If you have any questions or need clarification on anything, please don't hesitate to contact us at procuroapp@gmail.com.

---

**Package Version:** 1.1.0  
**Last Updated:** November 13, 2025  
**Prepared By:** Procuro Development Team  
**Status:** ✅ Complete & Ready for Intuit Submission

