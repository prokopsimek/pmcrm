# Pull Request

## Description

<!-- Provide a brief description of the changes in this PR -->

## Type of Change

<!-- Mark the relevant option with an "x" -->

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Refactoring (no functional changes, no api changes)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code quality improvement
- [ ] CI/CD configuration

## Related Issues

<!-- Link to related issues using #issue_number -->
<!-- Example: Closes #123, Relates to #456 -->

Closes #

## Changes Made

<!-- Provide a detailed description of what has changed -->

### Technical Details

<!-- Describe the technical implementation -->

### Business Logic

<!-- Explain the business logic and why these changes were necessary -->

## Testing

### How Has This Been Tested?

<!-- Describe the tests you ran to verify your changes -->

- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] Manual testing

### Test Configuration

<!-- Provide details of your test configuration -->
- **OS:**
- **Browser (if applicable):**
- **Node version:**

## Quality Checks

<!-- Ensure all checks pass before requesting review -->

- [ ] My code follows the code style of this project
- [ ] I have run `npm run quality:check` and all checks pass
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged and published

## TypeScript Compliance

<!-- Verify TypeScript strict mode compliance -->

- [ ] No `any` types used
- [ ] All functions have explicit return types
- [ ] Proper null/undefined handling (no non-null assertions)
- [ ] All errors are properly typed and handled
- [ ] Type guards used where necessary

## Security Considerations

<!-- Answer these security questions -->

- [ ] No hardcoded secrets or credentials
- [ ] Input validation implemented where needed
- [ ] Authentication/Authorization properly handled
- [ ] GDPR compliance verified (if handling personal data)
- [ ] SQL injection prevented (parameterized queries used)
- [ ] XSS prevention implemented (if rendering user content)

## Database Changes

<!-- If this PR includes database changes -->

- [ ] Migration scripts created and tested
- [ ] Rollback strategy documented
- [ ] Database indexes reviewed
- [ ] Data migration plan documented (if applicable)
- [ ] Performance impact assessed

## Breaking Changes

<!-- If this PR introduces breaking changes, describe them -->

### What breaks?

<!-- Describe what will break -->

### Migration guide

<!-- Provide step-by-step migration instructions -->

## Deployment Notes

<!-- Any special deployment considerations -->

### Environment Variables

<!-- List any new or changed environment variables -->

### Dependencies

<!-- List any new dependencies added -->

### Infrastructure Changes

<!-- Describe any infrastructure changes needed -->

## Screenshots

<!-- If applicable, add screenshots to help explain your changes -->

### Before


### After


## Performance Impact

<!-- Describe any performance implications -->

- [ ] No performance impact
- [ ] Performance improved
- [ ] Performance degraded (justify why)

### Metrics

<!-- If you measured performance, provide metrics -->

## Checklist for Reviewers

<!-- Help reviewers focus on important areas -->

### Focus Areas

<!-- What should reviewers pay special attention to? -->

### Known Issues

<!-- List any known issues or limitations -->

### Future Work

<!-- Any follow-up work planned? -->

## Additional Notes

<!-- Add any other context about the PR here -->

---

## For Reviewers

Please review according to the [Code Review Guidelines](../CODE_REVIEW_GUIDELINES.md).

### Review Checklist

- [ ] Code quality meets standards
- [ ] Tests are adequate
- [ ] Documentation is updated
- [ ] Security considerations addressed
- [ ] Performance impact acceptable
- [ ] No breaking changes (or properly documented)
