import * as Sentry from '@sentry/node';

const isTestRun = process.env.NODE_ENV === 'test' || process.argv.includes('test');

if (!isTestRun) {
  const { nodeProfilingIntegration } = require('@sentry/profiling-node');

  Sentry.init({
    dsn: 'https://37a6ced5bdae6c2d2a2061a4697d3e37@o4511517950345216.ingest.us.sentry.io/4511517955063808',
    integrations: [nodeProfilingIntegration()],

    // Send structured logs to Sentry
    enableLogs: true,
    // Tracing
    tracesSampleRate: 1.0, //  Capture 100% of the transactions
    // Set sampling rate for profiling - this is evaluated only once per SDK.init call
    profileSessionSampleRate: 1.0,
    // Trace lifecycle automatically enables profiling during active traces
    profileLifecycle: 'trace',
    // Setting this option to true will send default PII data to Sentry.
    // For example, automatic IP address collection on events
    sendDefaultPii: true,
  });

  // Profiling happens automatically after setting it up with `Sentry.init()`.
  // All spans (unless those discarded by sampling) will have profiling data attached to them.
  Sentry.startSpan(
    {
      name: 'Spanv1',
    },
    () => {
      // The code executed here will be profiled
    },
  );
}
