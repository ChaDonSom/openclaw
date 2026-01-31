# Copilot SDK Integration for OpenClaw

## 🎯 Goal

Replace Pi's agent runtime with GitHub Copilot SDK to enable **nested tool calls within a single premium request** instead of spawning separate agent sessions.

## 💡 The Problem

Current OpenClaw architecture using Pi:
```
User message → Main agent (1 premium request)
  ├─ Spawns sub-agent 1 (1 premium request)
  ├─ Spawns sub-agent 2 (1 premium request)
  └─ Spawns sub-agent 3 (1 premium request)
  
Total: 4 premium requests 💸
```

## ✨ The Solution

With Copilot SDK:
```
User message → Copilot Agent (1 premium request)
  ├─ Internal tool call 1
  ├─ Internal tool call 2
  └─ Internal tool call 3
  
Total: 1 premium request ⚡
```

## 🏗️ Architecture

### Runtime Selector
- **`src/agents/runtime-selector.ts`** - Toggle between Pi and Copilot
- Environment variable: `OPENCLAW_AGENT_RUNTIME=copilot|pi`
- Default: `pi` (backward compatibility)

### Copilot Runner
- **`src/agents/copilot-embedded-runner/run.ts`** - Main Copilot SDK integration
- Manages Copilot CLI process lifecycle
- Converts OpenClaw tools ↔ Copilot SDK format
- Streams responses back to OpenClaw message bus

### Shared Types
- **`src/agents/agent-types.ts`** - Common types for both runtimes

## 🚀 Usage

### Enable Copilot SDK Runtime

```bash
export OPENCLAW_AGENT_RUNTIME=copilot
clawdbot gateway
```

### Test the Integration

```bash
cd ~/clawd/openclaw-copilot-fork/openclaw
OPENCLAW_AGENT_RUNTIME=copilot node test-copilot.js
```

## 📝 Implementation Status

- [x] Install Copilot SDK (`@github/copilot-sdk`)
- [x] Create runtime selector
- [x] Create Copilot agent runner
- [x] Create type definitions
- [x] Create test script
- [ ] Implement tool execution bridge
- [ ] Test with real OpenClaw tools
- [ ] Add streaming support
- [ ] Add error handling
- [ ] Performance benchmarks
- [ ] Documentation

## 🔧 Configuration

Add to your OpenClaw config:

```yaml
agent:
  runtime: copilot  # or 'pi'
  copilot:
    model: claude-sonnet-4
    allowAll: true
    maxTurns: 10
```

## 🎁 Benefits

1. **Cost savings** - Massive reduction in premium requests
2. **Performance** - Faster nested operations
3. **Simplicity** - Copilot handles orchestration
4. **Compatibility** - Pi still available as fallback
5. **Production-tested** - Copilot SDK is the same engine as Copilot CLI

## 🧪 Testing

Run the test suite:

```bash
npm test -- copilot-integration
```

## 📚 Resources

- [Copilot SDK Repo](https://github.com/github/copilot-sdk)
- [Getting Started Guide](https://github.com/github/copilot-sdk/blob/main/docs/getting-started.md)
- [OpenClaw Documentation](https://docs.openclaw.ai)

## 🤝 Contributing

This is an experimental fork. Feedback welcome!

## 📄 License

MIT
