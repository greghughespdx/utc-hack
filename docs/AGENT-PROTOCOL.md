# Agent Collaboration Protocol

This document defines the protocol for AI agent collaboration on the UTC Hack project.

## Session Start Checklist

1. Read `thoughts/ledgers/YYYY-MM.md` (current month)
2. Check git log for recent changes: `git log --oneline -10`
3. Check project status: `git status --short`
4. Run tests: `npm test`
5. Review README.md for current architecture

## During Session

1. Update relevant ledger with decisions made
2. Document architectural changes immediately
3. Run tests before committing
4. Update documentation for API changes

## Session End Checklist

1. Run full test suite: `npm test`
2. Update ledger with today's architectural decisions
3. Commit all changes with descriptive message
4. Update README.md if API contracts changed
5. Note any technical debt or future work

## Handoff Format

When handing off work to another agent:

```markdown
### Handoff: [TOPIC]
**Date:** YYYY-MM-DD
**From:** [Agent Name]
**To:** [Next Agent or "Future Session"]

**Context:** Background information

**Completed:**
- What was done

**Pending:**
- What needs to be done next

**Files Changed:**
- List of modified files

**Verification:**
- How to verify the work
```

## Decision Documentation

All architectural decisions MUST be documented in `thoughts/ledgers/YYYY-MM.md` using this format:

```markdown
### YYYY-MM-DD: [Decision Topic]

**Context:** [Why this decision was needed]

**Decision:** [What was chosen]

**Rationale:** [Why this approach was selected]

**Implementation:** [Key technical details]
```

## Testing Requirements

Before any commit:

- [ ] All tests passing (`npm test`)
- [ ] TypeScript compiles (`npm run typecheck`)
- [ ] No console errors in manual testing
- [ ] Documentation updated for API changes

## Communication Conventions

### Status Indicators

- ✅ Complete and verified
- 🚧 In progress
- ⚠️ Blocked or needs attention
- 📋 Planned but not started

### Priority Levels

- **P0 - Critical:** Blocking production or core functionality
- **P1 - High:** Important feature or fix
- **P2 - Medium:** Enhancement or improvement
- **P3 - Low:** Nice-to-have or future consideration

## Agent Specialization Guidance

### Claude (Anthropic)

**Strengths:**

- Testing and validation
- Integration work
- Documentation writing
- Code review and quality assurance

**Best Used For:**

- Verifying implementations
- Writing comprehensive tests
- Creating documentation
- Browser testing

### Codex (OpenAI)

**Strengths:**

- Architectural planning
- Systematic refactoring
- Algorithm implementation
- Complex logic design

**Best Used For:**

- Planning new features
- Refactoring code
- Implementing core logic
- API design

## File Organization

```
utc-hack/
├── thoughts/
│   └── ledgers/          # Architectural decision logs
│       └── YYYY-MM.md
├── docs/
│   ├── AGENT-PROTOCOL.md # This file
│   └── [other docs]
├── src/                  # Source code
├── README.md             # User-facing documentation
└── package.json
```

## Version History

- **2026-01-21:** Initial protocol established during Claude + Codex collaboration session
