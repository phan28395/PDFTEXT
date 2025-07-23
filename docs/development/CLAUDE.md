# Claude Agent Instructions for PDF-to-Text SaaS Project

## Project Overview
This is a PDF-to-text conversion SaaS platform built with zero upfront costs using:
- **Frontend**: React + Vite + TypeScript + TailwindCSS
- **Backend**: Vercel serverless functions
- **Database**: Supabase (PostgreSQL + Auth)
- **Processing**: Google Document AI API
- **Payments**: Stripe
- **Security**: Enterprise-grade security measures

## Current Project Status
**Working Directory**: `E:\CompanyBuilding\PDF-TO-TEXT`

## Key Files to Read First
1. **docs/development/STATUS.md** - Current progress and handoff information (READ THIS FIRST!)
2. **docs/development/saas-plan.md** - Complete project plan with security requirements
3. **docs/development/step-by-step-implementation.md** - Detailed implementation steps
4. **package.json** - Dependencies and scripts (if exists)

## Your Role
You are continuing the development of this PDF-to-text SaaS platform. Each Claude agent builds upon the previous agent's work following the step-by-step implementation plan.

## Instructions for Continuation

### 1. FIRST: Read Current Status
```bash
# Always start by reading these files to understand current state:
- docs/development/STATUS.md (current progress and next steps)
- docs/development/step-by-step-implementation.md (full task list)
- docs/development/saas-plan.md (security and business requirements)
```

### 2. Understand Your Starting Point
- Check which step in `docs/development/step-by-step-implementation.md` is currently active
- Read the "Next Actions" section in docs/development/STATUS.md
- Review any "Known Issues" or "Important Notes"
- Check which files have been created/modified

### 3. Security Requirements (MANDATORY)
Every task must follow these security principles:
- **Server-side validation**: Never trust client-side validation alone
- **Input sanitization**: Escape/validate all user inputs
- **Rate limiting**: Implement for all user-facing endpoints
- **Environment variables**: Store all secrets securely
- **HTTPS only**: All communications must be encrypted
- **RLS (Row Level Security)**: Enable on all database tables
- **Audit logging**: Log all important actions

### 4. Implementation Guidelines

#### Code Quality Standards
- Use TypeScript for all new code
- Follow React best practices (hooks, functional components)
- Implement proper error handling
- Add loading states for all async operations
- Use TailwindCSS for styling
- Write clean, readable, self-documenting code

#### Testing Requirements
- Add unit tests for utility functions
- Test all API endpoints
- Validate security measures
- Test error scenarios and edge cases

#### File Organization
```
src/
├── components/     # Reusable UI components
├── pages/         # Page components
├── hooks/         # Custom React hooks
├── utils/         # Utility functions
├── types/         # TypeScript type definitions
├── api/           # API integration functions
└── styles/        # Global styles and TailwindCSS
```

### 5. Agent Handoff Protocol

After completing your assigned tasks:

1. **Update docs/development/STATUS.md** with:
   - Tasks completed (check them off)
   - Current step status
   - Next actions for the following agent
   - Any blockers or issues discovered
   - Configuration changes made
   - Files created/modified

2. **Create detailed commit messages** describing what was implemented

3. **Leave TODO comments** in code for complex items that need attention

4. **Document environment variables** needed in docs/development/STATUS.md

5. **Test your implementation** before marking tasks complete

### 6. Common Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Type checking
npm run type-check

# Linting
npm run lint

# Format code
npm run format
```

### 7. When You Encounter Issues

1. **Check existing issues** in docs/development/STATUS.md first
2. **Search codebase** for similar implementations
3. **Consult main plan** for security and business requirements
4. **Document the issue** in docs/development/STATUS.md for the next agent
5. **Provide workarounds** or alternative approaches when possible

### 8. Critical Security Checklist

Before marking any step complete, verify:
- [ ] All user inputs are validated server-side
- [ ] No sensitive data in client-side code
- [ ] Environment variables are properly secured
- [ ] Rate limiting is implemented where needed
- [ ] Error messages don't leak sensitive information
- [ ] Database queries use parameterization
- [ ] File uploads are properly validated and sanitized

### 9. Payment Integration Guidelines

When working on Stripe integration:
- Never store payment data locally
- Always validate webhooks with signature verification
- Use Stripe's test mode during development
- Implement idempotency for payment processing
- Handle all error scenarios gracefully

### 10. Database Guidelines

For Supabase integration:
- Always use Row Level Security (RLS)
- Create proper indexes for performance
- Use transactions for multi-step operations
- Implement proper error handling
- Follow the schema defined in docs/development/saas-plan.md

## Emergency Contacts & Resources

- **Supabase Documentation**: https://supabase.com/docs
- **Stripe Documentation**: https://stripe.com/docs
- **Google Document AI**: https://cloud.google.com/document-ai/docs
- **React Documentation**: https://react.dev
- **TailwindCSS**: https://tailwindcss.com/docs

## Current Task Prompt
**When you're ready to continue, use this exact prompt:**

"Please continue the process"

This will trigger you to:
1. Read docs/development/STATUS.md to understand current progress
2. Continue with the next step in docs/development/step-by-step-implementation.md
3. Follow all security and quality requirements
4. Update docs/development/STATUS.md with your progress when complete

**IMPORTANT**: If all 26 steps from docs/development/step-by-step-implementation.md are marked as completed in docs/development/STATUS.md, then respond with:

"Everything is done. No more implementation steps remain. The PDF-to-text SaaS platform is complete and ready for production deployment."

Do not attempt to create additional tasks or continue implementation beyond the defined 26-step plan.

## Important Reminders
- **Security first**: Every feature must be implemented securely
- **Zero-cost approach**: Use only free tiers and services
- **Quality over speed**: Better to implement fewer features well than many features poorly
- **Document everything**: The next agent needs to understand your work
- **Test thoroughly**: Don't mark tasks complete without testing

Good luck with your part of this project! Remember: you're building a production-ready SaaS platform that needs enterprise-grade security and reliability.