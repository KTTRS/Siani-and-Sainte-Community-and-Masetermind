import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  Clock,
  DollarSign,
  Heart,
  Home,
  Pill,
  Shield,
  TrendingUp,
  Users,
  Utensils,
  Car,
  Wallet,
  ChevronRight,
  RefreshCcw,
  Zap,
} from "lucide-react";

const LIME = "#A7E9BC";
const EVERGLADE = "#28513A";

const mockLiveSignals = [
  { id: 1, type: "housing", label: "Housing stress", count: 12, trend: "+3", urgent: true },
  { id: 2, type: "food", label: "Food insecurity", count: 8, trend: "+1", urgent: false },
  { id: 3, type: "medication", label: "Medication interruption", count: 5, trend: "-2", urgent: true },
  { id: 4, type: "transport", label: "Transport barrier", count: 7, trend: "+2", urgent: false },
  { id: 5, type: "income", label: "Income instability", count: 4, trend: "0", urgent: false },
  { id: 6, type: "safety", label: "Safety concern", count: 2, trend: "+1", urgent: true },
];

const mockReferralData = [
  { name: "Mon", active: 45, completed: 12 },
  { name: "Tue", active: 52, completed: 18 },
  { name: "Wed", active: 48, completed: 15 },
  { name: "Thu", active: 61, completed: 22 },
  { name: "Fri", active: 55, completed: 19 },
  { name: "Sat", active: 38, completed: 8 },
  { name: "Sun", active: 42, completed: 11 },
];

const mockRiskData = [
  { name: "Low", value: 245, color: "#22C55E" },
  { name: "Moderate", value: 89, color: "#EAB308" },
  { name: "High", value: 34, color: "#F97316" },
  { name: "Critical", value: 12, color: LIME },
];

const mockCostData = [
  { month: "Jul", forecasted: 45000, actual: 42000 },
  { month: "Aug", forecasted: 52000, actual: 48500 },
  { month: "Sep", forecasted: 48000, actual: 51000 },
  { month: "Oct", forecasted: 61000, actual: 58000 },
  { month: "Nov", forecasted: 55000, actual: 53000 },
];

const mockPreventionData = [
  { metric: "Primary Care Visits", completed: 234, target: 300, rate: 78 },
  { metric: "Screenings Completed", completed: 156, target: 200, rate: 78 },
  { metric: "Pharmacy Pickups", completed: 412, target: 450, rate: 92 },
  { metric: "Barriers Resolved", completed: 89, target: 120, rate: 74 },
];

const signalIcons: Record<string, typeof Home> = {
  housing: Home,
  food: Utensils,
  medication: Pill,
  transport: Car,
  income: Wallet,
  safety: Shield,
};

function StatCard({
  title,
  value,
  change,
  changeType,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: typeof Activity;
}) {
  return (
    <Card className="hover-elevate">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold mt-1 tabular-nums" data-testid={`stat-${title.toLowerCase().replace(/\s+/g, "-")}`}>{value}</p>
            {change && (
              <div className="flex items-center gap-1 mt-1">
                {changeType === "positive" ? (
                  <ArrowUpRight className="w-3 h-3" style={{ color: LIME }} />
                ) : changeType === "negative" ? (
                  <ArrowDownRight className="w-3 h-3" style={{ color: "#C26D5A" }} />
                ) : null}
                <span
                  className="text-xs"
                  style={{
                    color:
                      changeType === "positive"
                        ? LIME
                        : changeType === "negative"
                        ? "#C26D5A"
                        : undefined,
                  }}
                >
                  {change}
                </span>
              </div>
            )}
          </div>
          <div className="p-2 rounded-lg" style={{ backgroundColor: `${LIME}1A` }}>
            <Icon className="w-5 h-5" style={{ color: LIME }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LiveSignalsTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Events Today" value={48} change="+12 vs yesterday" changeType="positive" icon={Activity} />
        <StatCard title="Active Referrals" value={127} change="+8 this week" changeType="positive" icon={Building2} />
        <StatCard title="High Risk" value={12} change="-3 vs last week" changeType="positive" icon={AlertTriangle} />
        <StatCard title="Avg Sentiment" value="72%" change="+5%" changeType="positive" icon={Heart} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Needs Identified (24h)</CardTitle>
              <Button variant="ghost" size="icon" data-testid="button-refresh-signals">
                <RefreshCcw className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[280px]">
              <div className="space-y-3">
                {mockLiveSignals.map((signal) => {
                  const Icon = signalIcons[signal.type] || Activity;
                  return (
                    <div
                      key={signal.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover-elevate cursor-pointer"
                      data-testid={`signal-${signal.type}`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="p-2 rounded-lg"
                          style={{
                            backgroundColor: signal.urgent
                              ? `${LIME}33`
                              : "rgba(255,255,255,0.05)",
                          }}
                        >
                          <Icon
                            className="w-4 h-4"
                            style={{ color: signal.urgent ? LIME : "inherit" }}
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{signal.label}</p>
                          <p className="text-xs text-muted-foreground">{signal.count} members</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {signal.urgent && (
                          <Badge variant="destructive" className="text-xs">
                            Urgent
                          </Badge>
                        )}
                        <span
                          className={`text-xs font-medium ${
                            signal.trend.startsWith("+")
                              ? "text-red-400"
                              : signal.trend.startsWith("-")
                              ? "text-mint-200"
                              : "text-muted-foreground"
                          }`}
                        >
                          {signal.trend}
                        </span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Risk Tier Movement (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={mockRiskData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {mockRiskData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#1A1A1A",
                      border: "1px solid #333",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-4">
              {mockRiskData.map((tier) => (
                <div key={tier.name} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: tier.color }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {tier.name}: {tier.value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ReferralPipelineTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Active Referrals" value={127} icon={Building2} />
        <StatCard title="Avg Time to Accept" value="2.4 days" change="-0.3 days" changeType="positive" icon={Clock} />
        <StatCard title="Avg Time to Close" value="14.2 days" change="+1.1 days" changeType="negative" icon={Clock} />
        <StatCard title="Completion Rate" value="84%" change="+3%" changeType="positive" icon={TrendingUp} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Referral Activity (7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockReferralData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="name" stroke="#666" fontSize={12} />
                <YAxis stroke="#666" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "#1A1A1A",
                    border: "1px solid #333",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="active" fill={LIME} radius={[4, 4, 0, 0]} name="Active" />
                <Bar dataKey="completed" fill="#22C55E" radius={[4, 4, 0, 0]} name="Completed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Barriers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { barrier: "Waitlists", count: 34, pct: 28 },
                { barrier: "Transportation", count: 28, pct: 23 },
                { barrier: "Missing Documents", count: 22, pct: 18 },
                { barrier: "Language Barrier", count: 15, pct: 12 },
                { barrier: "Scheduling Conflicts", count: 12, pct: 10 },
              ].map((item) => (
                <div key={item.barrier} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{item.barrier}</span>
                    <span className="text-sm text-muted-foreground">{item.count} ({item.pct}%)</span>
                  </div>
                  <Progress value={item.pct} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Dropoff Points</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { stage: "Proposal → Offer", dropoff: 8, color: "#22C55E" },
                { stage: "Offer → Accept", dropoff: 15, color: "#EAB308" },
                { stage: "Accept → In Progress", dropoff: 5, color: "#F97316" },
                { stage: "In Progress → Complete", dropoff: 12, color: LIME },
              ].map((item) => (
                <div
                  key={item.stage}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                >
                  <span className="text-sm">{item.stage}</span>
                  <Badge
                    variant="outline"
                    style={{ borderColor: item.color, color: item.color }}
                  >
                    {item.dropoff}% dropoff
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PreventionTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {mockPreventionData.map((item) => (
          <Card key={item.metric} className="hover-elevate">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {item.metric}
              </p>
              <div className="mt-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{item.completed}</span>
                  <span className="text-sm text-muted-foreground">/ {item.target}</span>
                </div>
                <Progress value={item.rate} className="h-2 mt-2" />
                <p className="text-xs text-muted-foreground mt-1">{item.rate}% of target</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Members Overdue for Screenings</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {[
                { id: "M-001", screening: "Annual Wellness", daysOverdue: 45, priority: "high" },
                { id: "M-002", screening: "Diabetes Screening", daysOverdue: 30, priority: "high" },
                { id: "M-003", screening: "Cancer Screening", daysOverdue: 21, priority: "medium" },
                { id: "M-004", screening: "Mental Health Check", daysOverdue: 14, priority: "medium" },
                { id: "M-005", screening: "Vaccination", daysOverdue: 7, priority: "low" },
              ].map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{member.id}</p>
                      <p className="text-xs text-muted-foreground">{member.screening}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {member.daysOverdue} days overdue
                    </span>
                    <Badge
                      variant={
                        member.priority === "high"
                          ? "destructive"
                          : member.priority === "medium"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {member.priority}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function RisingRiskTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="High Risk (24h)" value={12} change="+3" changeType="negative" icon={AlertTriangle} />
        <StatCard title="Risk Escalations" value={5} change="+2" changeType="negative" icon={ArrowUpRight} />
        <StatCard title="Stabilized" value={8} change="+3" changeType="positive" icon={Shield} />
        <StatCard title="Avg Risk Score" value="62" change="-4" changeType="positive" icon={Activity} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Acute Risk Jumps (24h)</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[350px]">
            <div className="space-y-3">
              {[
                {
                  id: "M-127",
                  previousTier: "moderate",
                  currentTier: "high",
                  reasons: ["housing_loss", "medication_gap"],
                  time: "2h ago",
                },
                {
                  id: "M-089",
                  previousTier: "low",
                  currentTier: "critical",
                  reasons: ["safety_concern", "food_insecurity"],
                  time: "3h ago",
                },
                {
                  id: "M-234",
                  previousTier: "moderate",
                  currentTier: "high",
                  reasons: ["income_loss"],
                  time: "5h ago",
                },
                {
                  id: "M-156",
                  previousTier: "high",
                  currentTier: "critical",
                  reasons: ["medication_gap", "transport_barrier"],
                  time: "6h ago",
                },
              ].map((risk) => (
                <div
                  key={risk.id}
                  className="p-4 rounded-lg border"
                  style={{ borderColor: risk.currentTier === "critical" ? LIME : "#333" }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                        <AlertTriangle
                          className="w-5 h-5"
                          style={{
                            color:
                              risk.currentTier === "critical"
                                ? LIME
                                : risk.currentTier === "high"
                                ? "#F97316"
                                : "#EAB308",
                          }}
                        />
                      </div>
                      <div>
                        <p className="font-medium">{risk.id}</p>
                        <p className="text-xs text-muted-foreground">{risk.time}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{risk.previousTier}</Badge>
                      <ArrowUpRight className="w-4 h-4" style={{ color: LIME }} />
                      <Badge variant="destructive">{risk.currentTier}</Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {risk.reasons.map((reason) => (
                      <Badge key={reason} variant="secondary" className="text-xs">
                        {reason.replace(/_/g, " ")}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function CostAvoidanceTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Forecasted Savings" value="$261K" icon={DollarSign} />
        <StatCard title="Actual Savings" value="$252.5K" change="-3.2%" changeType="neutral" icon={DollarSign} />
        <StatCard title="Crises Prevented" value={34} change="+8" changeType="positive" icon={Shield} />
        <StatCard title="ROI" value="4.2x" change="+0.3x" changeType="positive" icon={TrendingUp} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Cost Avoidance Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockCostData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="month" stroke="#666" fontSize={12} />
                <YAxis stroke="#666" fontSize={12} tickFormatter={(v) => `$${v / 1000}K`} />
                <Tooltip
                  contentStyle={{
                    background: "#1A1A1A",
                    border: "1px solid #333",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
                />
                <Area
                  type="monotone"
                  dataKey="forecasted"
                  stroke={LIME}
                  fill={`${LIME}30`}
                  name="Forecasted"
                />
                <Area
                  type="monotone"
                  dataKey="actual"
                  stroke="#22C55E"
                  fill="rgba(34, 197, 94, 0.2)"
                  name="Actual"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Intervention Impact</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { intervention: "Housing Support", savings: 89000, cases: 12 },
              { intervention: "Medication Adherence", savings: 67000, cases: 28 },
              { intervention: "Food Security", savings: 45000, cases: 34 },
            ].map((item) => (
              <div
                key={item.intervention}
                className="p-4 rounded-lg bg-secondary/50 text-center"
              >
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  {item.intervention}
                </p>
                <p className="text-2xl font-bold mt-2" style={{ color: LIME }}>
                  ${(item.savings / 1000).toFixed(0)}K
                </p>
                <p className="text-xs text-muted-foreground mt-1">{item.cases} cases</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CHWLoadTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Tasks Automated" value={156} change="+23 this week" changeType="positive" icon={Zap} />
        <StatCard title="Self-Service Tasks" value={89} change="+12" changeType="positive" icon={Users} />
        <StatCard title="Cases Stabilized" value={34} change="+5" changeType="positive" icon={Shield} />
        <StatCard title="CHW Hours Saved" value="48h" change="+8h" changeType="positive" icon={Clock} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Task Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { category: "Automated by Siani", value: 156, pct: 45, color: LIME },
                { category: "Member Self-Service", value: 89, pct: 26, color: "#22C55E" },
                { category: "CHW Intervention", value: 67, pct: 19, color: "#EAB308" },
                { category: "Escalated", value: 34, pct: 10, color: "#F97316" },
              ].map((item) => (
                <div key={item.category} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm">{item.category}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {item.value} ({item.pct}%)
                    </span>
                  </div>
                  <Progress
                    value={item.pct}
                    className="h-2"
                    style={
                      {
                        "--progress-background": item.color,
                      } as React.CSSProperties
                    }
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Stabilization Before Escalation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={[
                    { week: "W1", stabilized: 12, escalated: 8 },
                    { week: "W2", stabilized: 15, escalated: 6 },
                    { week: "W3", stabilized: 18, escalated: 5 },
                    { week: "W4", stabilized: 22, escalated: 4 },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="week" stroke="#666" fontSize={12} />
                  <YAxis stroke="#666" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "#1A1A1A",
                      border: "1px solid #333",
                      borderRadius: "8px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="stabilized"
                    stroke="#22C55E"
                    strokeWidth={2}
                    name="Stabilized"
                  />
                  <Line
                    type="monotone"
                    dataKey="escalated"
                    stroke={LIME}
                    strokeWidth={2}
                    name="Escalated"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CBOPerformanceTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Partner CBOs" value={24} icon={Building2} />
        <StatCard title="Avg Acceptance Rate" value="78%" change="+3%" changeType="positive" icon={TrendingUp} />
        <StatCard title="Avg Time to Close" value="12.4 days" change="-2.1 days" changeType="positive" icon={Clock} />
        <StatCard title="Positive Outcomes" value="82%" change="+5%" changeType="positive" icon={Heart} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">CBO Performance Rankings</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {[
                {
                  name: "Community Health Partners",
                  acceptRate: 92,
                  closeTime: 8.2,
                  outcomes: 94,
                  repeatFail: 3,
                },
                {
                  name: "Unity Housing Services",
                  acceptRate: 88,
                  closeTime: 10.5,
                  outcomes: 89,
                  repeatFail: 5,
                },
                {
                  name: "Metro Food Bank",
                  acceptRate: 95,
                  closeTime: 5.1,
                  outcomes: 91,
                  repeatFail: 2,
                },
                {
                  name: "Transit Assistance Network",
                  acceptRate: 72,
                  closeTime: 14.2,
                  outcomes: 78,
                  repeatFail: 8,
                },
                {
                  name: "SafeHaven Services",
                  acceptRate: 85,
                  closeTime: 11.8,
                  outcomes: 86,
                  repeatFail: 6,
                },
              ].map((cbo, idx) => (
                <div
                  key={cbo.name}
                  className="p-4 rounded-lg border border-border hover-elevate"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                        style={{
                          backgroundColor:
                            idx === 0
                              ? LIME
                              : "rgba(255,255,255,0.1)",
                        }}
                      >
                        {idx + 1}
                      </div>
                      <p className="font-medium">{cbo.name}</p>
                    </div>
                    <Badge variant={cbo.outcomes >= 90 ? "default" : "secondary"}>
                      {cbo.outcomes}% success
                    </Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Accept Rate</p>
                      <p className="text-sm font-medium">{cbo.acceptRate}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Close Time</p>
                      <p className="text-sm font-medium">{cbo.closeTime}d</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Outcomes</p>
                      <p className="text-sm font-medium">{cbo.outcomes}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Repeat Fail</p>
                      <p className="text-sm font-medium">{cbo.repeatFail}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PayerDashboard() {
  const [activeTab, setActiveTab] = useState("live-signals");

  const { data: organizations, isLoading: orgsLoading } = useQuery<any[]>({
    queryKey: ["/api/dashboard/organizations"],
  });

  const orgId = organizations?.[0]?.id;

  const { data: dashboardStats } = useQuery<any>({
    queryKey: ["/api/dashboard/stats", orgId],
    enabled: !!orgId,
  });

  const { data: riskTiers } = useQuery<any>({
    queryKey: ["/api/dashboard/risk", orgId],
    enabled: !!orgId,
  });

  const isDemo = !orgId;

  if (orgsLoading) {
    return (
      <div className="min-h-screen app-ground flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-mint-200" />
          <p className="text-sm text-muted-foreground">Loading command center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-ground">
      <div className="sticky top-0 z-40 bg-everglade-900/80 backdrop-blur-md border-b border-[hsl(var(--rim))]">
        <div className="px-4 py-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                PAYER COMMAND CENTER
              </h1>
              <p className="text-sm text-muted-foreground">Population Health Analytics</p>
            </div>
            <div className="flex items-center gap-2">
              {isDemo && (
                <Badge variant="secondary" className="px-3 py-1" data-testid="badge-demo-mode">
                  DEMO
                </Badge>
              )}
              <Badge
                className="px-3 py-1"
                style={{ backgroundColor: LIME }}
              >
                LIVE
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 md:px-6 lg:px-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <ScrollArea className="w-full">
            <TabsList className="inline-flex h-auto p-1 bg-secondary/50 w-max">
              <TabsTrigger
                value="live-signals"
                className="text-xs px-3 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                data-testid="tab-live-signals"
              >
                Live Signals
              </TabsTrigger>
              <TabsTrigger
                value="referrals"
                className="text-xs px-3 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                data-testid="tab-referrals"
              >
                Referral Pipeline
              </TabsTrigger>
              <TabsTrigger
                value="prevention"
                className="text-xs px-3 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                data-testid="tab-prevention"
              >
                Prevention
              </TabsTrigger>
              <TabsTrigger
                value="risk"
                className="text-xs px-3 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                data-testid="tab-risk"
              >
                Rising Risk
              </TabsTrigger>
              <TabsTrigger
                value="cost"
                className="text-xs px-3 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                data-testid="tab-cost"
              >
                Cost Avoidance
              </TabsTrigger>
              <TabsTrigger
                value="chw"
                className="text-xs px-3 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                data-testid="tab-chw"
              >
                CHW Load
              </TabsTrigger>
              <TabsTrigger
                value="cbo"
                className="text-xs px-3 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                data-testid="tab-cbo"
              >
                CBO Performance
              </TabsTrigger>
            </TabsList>
          </ScrollArea>

          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <TabsContent value="live-signals" className="mt-0">
              <LiveSignalsTab />
            </TabsContent>
            <TabsContent value="referrals" className="mt-0">
              <ReferralPipelineTab />
            </TabsContent>
            <TabsContent value="prevention" className="mt-0">
              <PreventionTab />
            </TabsContent>
            <TabsContent value="risk" className="mt-0">
              <RisingRiskTab />
            </TabsContent>
            <TabsContent value="cost" className="mt-0">
              <CostAvoidanceTab />
            </TabsContent>
            <TabsContent value="chw" className="mt-0">
              <CHWLoadTab />
            </TabsContent>
            <TabsContent value="cbo" className="mt-0">
              <CBOPerformanceTab />
            </TabsContent>
          </motion.div>
        </Tabs>
      </div>
    </div>
  );
}
