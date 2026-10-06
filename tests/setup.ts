// Test environment: a fixed throwaway encryption key and no language model,
// so tests are deterministic and never touch the network.
process.env.FOODLINK_DATA_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.FOODLINK_AI_MODE = "rules";
delete process.env.ANTHROPIC_API_KEY;
