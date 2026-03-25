import { useProactiveAlerts, type ProactiveAlert } from '@/hooks/useProactiveAlerts';
import { AlertTriangle, X, TrendingUp, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const severityStyles = {
  danger: 'bg-destructive/10 border-destructive/30 text-destructive',
  warning: 'bg-warning/10 border-warning/30 text-warning',
  info: 'bg-primary/10 border-primary/30 text-primary',
};

const severityIcons = {
  danger: AlertTriangle,
  warning: TrendingUp,
  info: Info,
};

export function ProactiveAlertsCard() {
  const { alerts, isLoading, dismissAlert } = useProactiveAlerts();

  if (isLoading || alerts.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-destructive/20 bg-card p-4 space-y-2"
    >
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <span className="text-sm font-semibold text-foreground">Alertas do Big B</span>
      </div>
      <AnimatePresence>
        {alerts.map((alert, i) => {
          const Icon = severityIcons[alert.severity];
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 border ${severityStyles[alert.severity]}`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span className="flex-1 leading-relaxed">{alert.message}</span>
              <button onClick={() => dismissAlert(i)} className="shrink-0 opacity-60 hover:opacity-100">
                <X className="h-3 w-3" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}
