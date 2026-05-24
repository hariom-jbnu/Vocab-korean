# Contributing to Vocab Korean

We appreciate your interest in contributing to this project! Here are some guidelines to help you get started.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Create a new branch** for your feature/fix
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Code Guidelines

- Use TypeScript for type safety
- Follow the existing code style and patterns
- Keep components focused and reusable
- Add comments for complex logic
- Test your changes locally before submitting

## Submitting Changes

1. **Make your changes** in your feature branch
2. **Commit with clear messages**
   ```bash
   git commit -m "feat: add descriptive message"
   ```
3. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```
4. **Open a Pull Request** with a clear description of changes

## Security

- **Never commit secrets** or API keys
- Always use `.env.local` for sensitive data
- Review the [SECURITY_REPORT.md](SECURITY_REPORT.md) before contributing

## Report Issues

Found a bug? Please open an issue with:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Your environment (OS, browser, etc.)

## Contact

Have questions? Reach out through:
- **GitHub Issues** for bug reports and feature requests
- **GitHub Discussions** for general questions

Thank you for contributing! 🎉
