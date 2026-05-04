import { onCLS, onINP, onLCP, onTTFB, onFCP, type Metric } from "web-vitals";

type Reporter = (metric: Metric) => void;

const log: Reporter = (metric) => {
  console.info("[web-vitals]", metric.name, Math.round(metric.value), metric);
};

export const reportWebVitals = (reporter: Reporter = log): void => {
  onCLS(reporter);
  onINP(reporter);
  onLCP(reporter);
  onTTFB(reporter);
  onFCP(reporter);
};
