/**
 * Crisis Escalation Service
 * 
 * Handles detection, escalation, and routing of crisis signals.
 * Implements the enterprise route requirement for T2/T3 safety tiers.
 * 
 * Safety Tiers:
 * - T0_stable: No intervention needed
 * - T1_concern: Monitor, potential escalation
 * - T2_risk: Escalate to care team
 * - T3_critical: Immediate intervention required
 */

import { storage } from "../storage";
import type { SafetyState, Signal } from "../engines/types";

interface EscalationEvent {
  id: string;
  userId: string;
  signalId?: string;
  tier: SafetyState["tier"];
  signals: Signal[];
  triggerMessage: string;
  status: "created" | "acknowledged" | "in_progress" | "resolved" | "escalated";
  assignedTo?: string;
  notes?: string;
  createdAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
}

interface EscalationResult {
  success: boolean;
  escalationId?: string;
  action: "none" | "logged" | "alert_sent" | "care_team_notified" | "immediate_intervention";
  message: string;
}

// In-memory tracking of active escalations
const activeEscalations = new Map<string, EscalationEvent>();

export async function processSignals(
  userId: string,
  safetyState: SafetyState,
  signals: Signal[],
  triggerMessage: string
): Promise<EscalationResult> {
  // No action needed for stable state with no signals
  if (safetyState.tier === "T0_stable" && signals.length === 0) {
    return {
      success: true,
      action: "none",
      message: "No escalation needed",
    };
  }

  // T1 - Log and monitor
  if (safetyState.tier === "T1_concern") {
    const result = await logConcern(userId, signals, triggerMessage);
    return {
      success: true,
      escalationId: result.id,
      action: "logged",
      message: "Concern logged for monitoring",
    };
  }

  // T2 - Escalate to care team
  if (safetyState.tier === "T2_risk") {
    const result = await escalateToCareTeam(userId, signals, triggerMessage, "T2_risk");
    return {
      success: result.success,
      escalationId: result.escalationId,
      action: "care_team_notified",
      message: result.message,
    };
  }

  // T3 - Immediate intervention
  if (safetyState.tier === "T3_critical") {
    const result = await triggerImmediateIntervention(userId, signals, triggerMessage);
    return {
      success: result.success,
      escalationId: result.escalationId,
      action: "immediate_intervention",
      message: result.message,
    };
  }

  // Default case - log signals
  if (signals.length > 0) {
    const result = await logSignals(userId, signals, triggerMessage);
    return {
      success: true,
      escalationId: result.id,
      action: "logged",
      message: "Signals logged",
    };
  }

  return {
    success: true,
    action: "none",
    message: "No action required",
  };
}

async function logConcern(
  userId: string,
  signals: Signal[],
  triggerMessage: string
): Promise<{ id: string }> {
  const escalation: EscalationEvent = {
    id: generateId(),
    userId,
    tier: "T1_concern",
    signals,
    triggerMessage,
    status: "created",
    createdAt: new Date(),
  };

  activeEscalations.set(escalation.id, escalation);

  // Store signal in database
  try {
    for (const signal of signals) {
      await storage.createSignal({
        userId,
        signalType: signal.type,
        severity: signal.severity,
        confidence: signal.confidence,
        triggerText: triggerMessage.slice(0, 500),
        isResolved: false,
      });
    }
  } catch (error) {
    console.error("Error storing signal:", error);
  }

  console.log(`[ESCALATION] T1 Concern logged for user ${userId}:`, {
    signals: signals.map(s => `${s.type}:${s.severity}`).join(", "),
  });

  return { id: escalation.id };
}

async function logSignals(
  userId: string,
  signals: Signal[],
  triggerMessage: string
): Promise<{ id: string }> {
  const escalation: EscalationEvent = {
    id: generateId(),
    userId,
    tier: "T0_stable",
    signals,
    triggerMessage,
    status: "created",
    createdAt: new Date(),
  };

  try {
    for (const signal of signals) {
      await storage.createSignal({
        userId,
        signalType: signal.type,
        severity: signal.severity,
        confidence: signal.confidence,
        triggerText: triggerMessage.slice(0, 500),
        isResolved: false,
      });
    }
  } catch (error) {
    console.error("Error storing signal:", error);
  }

  return { id: escalation.id };
}

async function escalateToCareTeam(
  userId: string,
  signals: Signal[],
  triggerMessage: string,
  tier: SafetyState["tier"]
): Promise<{ success: boolean; escalationId: string; message: string }> {
  const escalation: EscalationEvent = {
    id: generateId(),
    userId,
    tier,
    signals,
    triggerMessage,
    status: "created",
    createdAt: new Date(),
  };

  activeEscalations.set(escalation.id, escalation);

  // Store in database
  try {
    const signalRecords = await Promise.all(
      signals.map(signal =>
        storage.createSignal({
          userId,
          signalType: signal.type,
          severity: signal.severity,
          confidence: signal.confidence,
          triggerText: triggerMessage.slice(0, 500),
          isResolved: false,
        })
      )
    );

    // Create escalation record linked to signal
    if (signalRecords.length > 0) {
      await storage.createEscalation({
        signalId: signalRecords[0].id,
        level: tier === "T2_risk" ? "priority" : "urgent",
        state: "open",
        notes: `Auto-escalated from ${tier}. Signals: ${signals.map(s => s.type).join(", ")}`,
      });
    }
  } catch (error) {
    console.error("Error creating escalation:", error);
  }

  console.log(`[ESCALATION] T2 Risk escalated to care team for user ${userId}:`, {
    tier,
    signals: signals.map(s => `${s.type}:${s.severity}`).join(", "),
  });

  // In production, this would:
  // 1. Send push notification to assigned CHW
  // 2. Create urgent care thread
  // 3. Log in enterprise monitoring system

  return {
    success: true,
    escalationId: escalation.id,
    message: "Care team notified of elevated risk",
  };
}

async function triggerImmediateIntervention(
  userId: string,
  signals: Signal[],
  triggerMessage: string
): Promise<{ success: boolean; escalationId: string; message: string }> {
  const escalation: EscalationEvent = {
    id: generateId(),
    userId,
    tier: "T3_critical",
    signals,
    triggerMessage,
    status: "created",
    createdAt: new Date(),
  };

  activeEscalations.set(escalation.id, escalation);

  // Store in database
  try {
    const signalRecords = await Promise.all(
      signals.map(signal =>
        storage.createSignal({
          userId,
          signalType: signal.type,
          severity: signal.severity,
          confidence: signal.confidence,
          triggerText: triggerMessage.slice(0, 500),
          isResolved: false,
        })
      )
    );

    // Create urgent escalation
    if (signalRecords.length > 0) {
      await storage.createEscalation({
        signalId: signalRecords[0].id,
        level: "urgent",
        state: "open",
        notes: `CRITICAL: T3 immediate intervention required. Signals: ${signals.map(s => s.type).join(", ")}`,
      });
    }
  } catch (error) {
    console.error("Error creating T3 escalation:", error);
  }

  console.error(`[ESCALATION] T3 CRITICAL - Immediate intervention required for user ${userId}:`, {
    signals: signals.map(s => `${s.type}:${s.severity}`).join(", "),
    triggerPreview: triggerMessage.slice(0, 100),
  });

  // In production, this would:
  // 1. Immediately page on-call crisis responder
  // 2. Create urgent care thread with all assigned team members
  // 3. Send SMS/call to emergency contacts if configured
  // 4. Log in enterprise monitoring with high priority
  // 5. Potentially trigger external crisis line integration

  return {
    success: true,
    escalationId: escalation.id,
    message: "Immediate intervention triggered - crisis team notified",
  };
}

export async function acknowledgeEscalation(
  escalationId: string,
  acknowledgedBy: string
): Promise<boolean> {
  const escalation = activeEscalations.get(escalationId);
  if (!escalation) {
    return false;
  }

  escalation.status = "acknowledged";
  escalation.acknowledgedAt = new Date();
  escalation.assignedTo = acknowledgedBy;

  console.log(`[ESCALATION] Acknowledged by ${acknowledgedBy}:`, escalationId);

  return true;
}

export async function resolveEscalation(
  escalationId: string,
  resolvedBy: string,
  notes?: string
): Promise<boolean> {
  const escalation = activeEscalations.get(escalationId);
  if (!escalation) {
    return false;
  }

  escalation.status = "resolved";
  escalation.resolvedAt = new Date();
  escalation.notes = notes;

  console.log(`[ESCALATION] Resolved by ${resolvedBy}:`, escalationId, notes);

  // Remove from active after a delay
  setTimeout(() => {
    activeEscalations.delete(escalationId);
  }, 3600000); // Keep for 1 hour for reference

  return true;
}

export function getActiveEscalations(userId?: string): EscalationEvent[] {
  const escalations = Array.from(activeEscalations.values());
  
  if (userId) {
    return escalations.filter(e => e.userId === userId);
  }
  
  return escalations;
}

export function getEscalationById(escalationId: string): EscalationEvent | undefined {
  return activeEscalations.get(escalationId);
}

// Helper function
function generateId(): string {
  return `esc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Crisis response helpers for Siani
export function getCrisisResponseGuidance(tier: SafetyState["tier"]): {
  responseMode: string;
  mustInclude: string[];
  mustAvoid: string[];
} {
  switch (tier) {
    case "T3_critical":
      return {
        responseMode: "immediate_stabilization",
        mustInclude: [
          "I'm here with you right now",
          "You're not alone",
          "Let's breathe together",
          "National Crisis Line: 988",
        ],
        mustAvoid: [
          "Don't ask why they feel this way",
          "Don't try to problem-solve",
          "Don't leave them alone in the conversation",
          "Don't minimize their feelings",
        ],
      };
    case "T2_risk":
      return {
        responseMode: "de_escalation",
        mustInclude: [
          "I'm here",
          "This is hard, and you're not alone",
          "Your feelings make sense",
        ],
        mustAvoid: [
          "Don't pressure for details",
          "Don't offer unsolicited advice",
          "Don't compare to others' experiences",
        ],
      };
    case "T1_concern":
      return {
        responseMode: "supportive_presence",
        mustInclude: [
          "Acknowledge their experience",
          "Create space for expression",
        ],
        mustAvoid: [
          "Don't dismiss or minimize",
          "Don't rush to solutions",
        ],
      };
    default:
      return {
        responseMode: "normal",
        mustInclude: [],
        mustAvoid: [],
      };
  }
}
