# Testing Guide

This document describes the testing setup and how to run tests for the Pause Menu application.

## Frontend Testing

### Setup

Frontend tests use **Vitest** with **React Testing Library** and **jsdom** for a browser-like environment.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### Test Structure

- **Component Tests**: `src/components/**/__tests__/*.test.tsx`
- **Hook Tests**: `src/hooks/__tests__/*.test.ts`
- **Utility Tests**: `src/utils/__tests__/*.test.ts`

### Example Tests

#### Component Test
```typescript
import { render, screen } from '@testing-library/react';
import { LoadingSpinner } from '../LoadingSpinner';

test('renders loading spinner', () => {
  render(<LoadingSpinner />);
  const spinner = screen.getByRole('status');
  expect(spinner).toBeInTheDocument();
});
```

#### Hook Test
```typescript
import { renderHook } from '@testing-library/react';
import { useFocus } from '../useFocus';

test('initializes with inactive state', () => {
  const { result } = renderHook(() => useFocus());
  expect(result.current.isActive).toBe(false);
});
```

#### Utility Test
```typescript
import { formatTime } from '../timeUtils';

test('formats time correctly', () => {
  const date = new Date('2024-01-15T14:30:00Z');
  expect(formatTime(date)).toBe('14:30');
});
```

## Backend Testing (Rust)

### Setup

Rust tests use the built-in `cargo test` command. Tests are located alongside the code they test.

### Running Tests

```bash
# Run all tests
cd src-tauri
cargo test

# Run tests for a specific module
cargo test --lib commands::auth

# Run tests with output
cargo test -- --nocapture

# Run tests for a specific test
cargo test test_url_validation
```

### Test Structure

- **Command Tests**: Tests are in `#[cfg(test)]` modules within command files
- **Service Tests**: Tests are in `#[cfg(test)]` modules within service files
- **Unit Tests**: Tests are in separate `__tests__` modules

### Example Tests

#### Command Test
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_url_validation() {
        let valid_url = "https://example.com";
        assert!(valid_url.starts_with("http://") || valid_url.starts_with("https://"));
    }
}
```

#### Service Test
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_focus_mode_duration() {
        let duration = 25;
        assert_eq!(duration, 25);
    }
}
```

## Test Coverage

### Frontend Coverage

Run coverage reports:
```bash
npm run test:coverage
```

Coverage reports are generated in `coverage/` directory.

### Backend Coverage

For Rust code coverage, you can use tools like:
- `cargo-tarpaulin` - Code coverage tool for Rust
- `grcov` - Code coverage tool that works with LLVM

## Writing New Tests

### Frontend Tests

1. Create test file: `ComponentName.test.tsx` or `hookName.test.ts`
2. Import testing utilities and the component/hook
3. Write test cases using `describe` and `it` blocks
4. Use React Testing Library queries to interact with components
5. Mock external dependencies (Tauri APIs, services, etc.)

### Backend Tests

1. Add `#[cfg(test)]` module to your Rust file
2. Write test functions with `#[test]` attribute
3. Use `assert!`, `assert_eq!`, `assert_ne!` macros
4. For async tests, use `#[tokio::test]`

## Mocking

### Frontend Mocks

Tauri APIs are automatically mocked in `src/test/setup.ts`. Additional mocks can be added there.

### Backend Mocks

For complex services, consider using mock traits or dependency injection patterns.

## Continuous Integration

Tests should be run in CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run frontend tests
  run: npm test

- name: Run backend tests
  run: cd src-tauri && cargo test
```

## Best Practices

1. **Test Behavior, Not Implementation**: Focus on what the code does, not how it does it
2. **Keep Tests Simple**: Each test should verify one thing
3. **Use Descriptive Names**: Test names should clearly describe what they test
4. **Arrange-Act-Assert**: Structure tests with setup, action, and verification
5. **Mock External Dependencies**: Don't test third-party code
6. **Test Edge Cases**: Include tests for error conditions and boundary values
7. **Keep Tests Fast**: Avoid slow operations in tests
8. **Maintain Test Independence**: Tests should not depend on each other

## Troubleshooting

### Frontend Tests

- **Tauri API errors**: Ensure mocks are properly set up in `setup.ts`
- **Module not found**: Check import paths and aliases in `vitest.config.ts`
- **Timeout errors**: Increase timeout or check for async operations

### Backend Tests

- **Compilation errors**: Ensure all dependencies are in `Cargo.toml`
- **Test failures**: Run with `--nocapture` to see output
- **Async test issues**: Use `#[tokio::test]` for async functions

