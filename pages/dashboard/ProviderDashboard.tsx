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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ClipboardList,
  Heart,
  MessageSquare,
  Phone,
  TrendingUp,
  User,
  Users,
  Zap,
  ChevronRight,
  Filter,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";

const LIME = "#A7E9BC";
const EVERGLADE = "#28513A";

const mockCaseload = [
  {
    id: "M-127",
    initials: "JD",
    riskLevel: "critical",
    tags: ["housing_loss", "medication_gap"],
    lastContact: "2h ago",
    nextAction: "Follow up on housing application",
    priority: 1,
  },
  {
    id: "M-089",
    initials: "AS",
    riskLevel: "high",
    tags: ["food_insecurity", "transport_barrier"],
    lastContact: "1d ago",
    nextAction: "Schedule food bank visit",
    priority: 2,
  },
  {
    id: "M-234",
    initials: "MK",
    riskLevel: "moderate",
    tags: ["income_instability"],
    lastContact: "3d ago",
    nextAction: "Review benefits application",
    priority: 3,
  },
  {
    id: "M-156",
    initials: "TR",
    riskLevel: "high",
    tags: ["medication_gap", "isolation"],
    lastContact: "4h ago",
    nextAction: "Pharmacy coordination call",
    priority: 4,
  },
  {
    id: "M-312",
    initials: "LB",
    riskLevel: "low",
    tags: ["preventive_care"],
    lastContact: "1w ago",
    nextAction: "Wellness check-in",
    priority: 5,
  },
];

const mockReferrals = [
  {
    id: "R-001",
    memberId: "M-127",
    resource: "Unity Housing Services",
    status: "pending",
    created: "2d ago",
    dueDate: "3 days",
  },
  {
    id: "R-002",
    memberId: "M-089",
    resource: "Metro Food Bank",
    status: "in_progress",
    created: "5d ago",
    dueDate: "1 day",
  },
  {
    id: "R-003",
    memberId: "M-234",
    resource: "Benefits Assistance",
    status: "accepted",
    created: "1w ago",
    dueDate: "5 days",
  },
  {
    id: "R-004",
    memberId: "M-156",
    resource: "Pharmacy Partner Program",
    status: "pending",
    created: "1d ago",
    dueDate: "2 days",
  },
];

const mockActions = [
  {
    id: "A-001",
    type: "siani_generated",
    action: "Schedule wellness check for M-312",
    status: "pending",
    created: "1h ago",
  },
  {
    id: "A-002",
    type: "chw_required",
    action: "In-person visit needed for M-127",
    status: "urgent",
    created: "2h ago",
  },
  {
    id: "A-003",
    type: "siani_generated",
    action: "Send medication reminder to M-156",
    status: "completed",
    created: "3h ago",
  },
  {
    id: "A-004",
    type: "chw_required",
    action: "Review housing docs for M-089",
    status: "pending",
    created: "4h ago",
  },
  {
    id: "A-005",
    type: "siani_generated",
    action: "Follow-up call scheduled for M-234",
    status: "scheduled",
    created: "5h ago",
  },
];

const mockPerformanceData = [
  { week: "W1", completed: 12, pending: 5 },
  { week: "W2", completed: 15, pending: 4 },
  { week: "W3", completed: 18, pending: 3 },
  { week: "W4", completed: 22, pending: 2 },
];

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: typeof Activity;
  trend?: { value: string; positive: boolean };
}) {
  return (
    <Card className="hover-elevate">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold mt-1 tabular-nums" data-testid={`stat-${title.toLowerCase().replace(/\s+/g, "-")}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
            {trend && (
              <p
                className="text-xs mt-1"
                style={{ color: trend.positive ? LIME : "#C26D5A" }}
              >
                {trend.value}
              </p>
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

function getRiskColor(level: string) {
  switch (level) {
    case "critical":
      return LIME;
    case "high":
      return "#F97316";
    case "moderate":
      return "#EAB308";
    case "low":
      return "#22C55E";
    default:
      return "#666";
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "completed":
      return "#22C55E";
    case "in_progress":
      return "#3B82F6";
    case "accepted":
      return "#A7E9BC";
    case "pending":
      return "#EAB308";
    case "urgent":
      return LIME;
    case "scheduled":
      return "#06B6D4";
    default:
      return "#666";
  }
}

function CaseloadTab() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCaseload = mockCaseload.filter(
    (member) =>
      member.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Active Cases" value={28} subtitle="Your caseload" icon={Users} />
        <StatCard
          title="High Priority"
          value={8}
          subtitle="Need attention"
          icon={AlertTriangle}
          trend={{ value: "+2 today", positive: false }}
        />
        <StatCard title="Pending Tasks" value={12} subtitle="Due this week" icon={ClipboardList} />
        <StatCard
          title="Completion Rate"
          value="87%"
          subtitle="This month"
          icon={TrendingUp}
          trend={{ value: "+5% vs last month", positive: true }}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-base">Prioritized Member List</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 w-48"
                  data-testid="input-search-members"
                />
              </div>
              <Button variant="outline" size="sm" data-testid="button-filter">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {filteredCaseload.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover-elevate cursor-pointer"
                  data-testid={`member-${member.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback
                          className="bg-forest-2"
                          style={{
                            color: getRiskColor(member.riskLevel),
                            borderWidth: '2px',
                            borderColor: getRiskColor(member.riskLevel),
                          }}
                        >
                          {member.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{
                          backgroundColor: getRiskColor(member.riskLevel),
                          color: member.riskLevel === "critical" ? "#0C1712" : "#F6F8F7",
                        }}
                      >
                        {member.priority}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{member.id}</p>
                        <Badge
                          variant="outline"
                          style={{
                            borderColor: getRiskColor(member.riskLevel),
                            color: getRiskColor(member.riskLevel),
                          }}
                        >
                          {member.riskLevel}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {member.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Last contact: {member.lastContact}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden md:block">
                      <p className="text-xs text-muted-foreground">Next Action</p>
                      <p className="text-sm">{member.nextAction}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" data-testid={`button-call-${member.id}`}>
                        <Phone className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" data-testid={`button-message-${member.id}`}>
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
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

function ReferralsTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Active Referrals" value={18} icon={ClipboardList} />
        <StatCard
          title="Pending Accept"
          value={6}
          subtitle="Awaiting CBO"
          icon={Clock}
        />
        <StatCard
          title="Due This Week"
          value={4}
          subtitle="Need follow-up"
          icon={AlertTriangle}
        />
        <StatCard
          title="Completed (30d)"
          value={23}
          icon={CheckCircle2}
          trend={{ value: "+8 vs last month", positive: true }}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Referral Tracker</CardTitle>
            <Button size="sm" data-testid="button-new-referral">
              New Referral
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {mockReferrals.map((referral) => (
                <div
                  key={referral.id}
                  className="p-4 rounded-lg border border-border hover-elevate"
                  data-testid={`referral-${referral.id}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium">{referral.resource}</p>
                        <p className="text-xs text-muted-foreground">
                          Member: {referral.memberId} | Created: {referral.created}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      style={{
                        borderColor: getStatusColor(referral.status),
                        color: getStatusColor(referral.status),
                      }}
                    >
                      {referral.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        Due: {referral.dueDate}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" data-testid={`button-update-${referral.id}`}>
                        Update Status
                      </Button>
                      <Button variant="ghost" size="icon">
                        <ChevronRight className="w-4 h-4" />
                      </Button>
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

function MemberProfilesTab() {
  const selectedMember = mockCaseload[0];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Member Profile</CardTitle>
            <div className="flex items-center gap-2">
              <Input placeholder="Search member ID..." className="h-9 w-48" />
              <Button variant="outline" size="sm">
                Search
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <div className="text-center p-6 rounded-lg bg-secondary/50">
                <Avatar className="h-20 w-20 mx-auto">
                  <AvatarFallback
                    className="text-2xl bg-forest-2"
                    style={{
                      color: getRiskColor(selectedMember.riskLevel),
                      borderWidth: '2px',
                      borderColor: getRiskColor(selectedMember.riskLevel),
                    }}
                  >
                    {selectedMember.initials}
                  </AvatarFallback>
                </Avatar>
                <p className="font-bold text-lg mt-3">{selectedMember.id}</p>
                <Badge
                  className="mt-2"
                  style={{
                    backgroundColor: `${getRiskColor(selectedMember.riskLevel)}20`,
                    color: getRiskColor(selectedMember.riskLevel),
                    border: `1px solid ${getRiskColor(selectedMember.riskLevel)}40`,
                  }}
                >
                  {selectedMember.riskLevel.toUpperCase()} RISK
                </Badge>
                <p className="text-xs text-muted-foreground mt-3">
                  Last contact: {selectedMember.lastContact}
                </p>
              </div>

              <div className="mt-4 space-y-2">
                <Button className="w-full" data-testid="button-contact-member">
                  <Phone className="w-4 h-4 mr-2" />
                  Contact
                </Button>
                <Button variant="outline" className="w-full" data-testid="button-add-note">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Add Note
                </Button>
              </div>
            </div>

            <div className="md:col-span-2 space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Active Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedMember.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Recent Signals</h4>
                <div className="space-y-2">
                  {[
                    { signal: "Housing application submitted", time: "2h ago", type: "positive" },
                    { signal: "Medication pickup missed", time: "1d ago", type: "negative" },
                    { signal: "Engaged with Siani", time: "3d ago", type: "neutral" },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{
                            backgroundColor:
                              item.type === "positive"
                                ? "#22C55E"
                                : item.type === "negative"
                                ? LIME
                                : "#666",
                          }}
                        />
                        <span className="text-sm">{item.signal}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{item.time}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Next Action</h4>
                <div className="p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-2">
                    <ArrowRight className="w-4 h-4" style={{ color: LIME }} />
                    <span className="text-sm">{selectedMember.nextAction}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-xs text-amber-500 font-medium">
                  HIPAA Notice: Conversation transcripts are not displayed. Only de-identified tags and signals are shown.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ActionsTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Siani Tasks" value={8} subtitle="Auto-generated" icon={Zap} />
        <StatCard title="CHW Required" value={5} subtitle="Need intervention" icon={User} />
        <StatCard title="Completed Today" value={12} icon={CheckCircle2} />
        <StatCard title="Overdue" value={2} subtitle="Need attention" icon={AlertTriangle} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Siani-Generated Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {mockActions
                  .filter((a) => a.type === "siani_generated")
                  .map((action) => (
                    <div
                      key={action.id}
                      className="p-3 rounded-lg bg-secondary/50 hover-elevate"
                      data-testid={`action-${action.id}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4" style={{ color: LIME }} />
                          <span className="text-xs text-muted-foreground">Auto-generated</span>
                        </div>
                        <Badge
                          variant="outline"
                          style={{
                            borderColor: getStatusColor(action.status),
                            color: getStatusColor(action.status),
                          }}
                        >
                          {action.status}
                        </Badge>
                      </div>
                      <p className="text-sm">{action.action}</p>
                      <p className="text-xs text-muted-foreground mt-2">{action.created}</p>
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">CHW Intervention Required</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {mockActions
                  .filter((a) => a.type === "chw_required")
                  .map((action) => (
                    <div
                      key={action.id}
                      className="p-3 rounded-lg border hover-elevate"
                      style={{ borderColor: action.status === "urgent" ? LIME : undefined }}
                      data-testid={`action-${action.id}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          <span className="text-xs text-muted-foreground">CHW Required</span>
                        </div>
                        <Badge
                          variant={action.status === "urgent" ? "destructive" : "outline"}
                        >
                          {action.status}
                        </Badge>
                      </div>
                      <p className="text-sm">{action.action}</p>
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-xs text-muted-foreground">{action.created}</p>
                        <Button size="sm" variant="outline" data-testid={`button-complete-${action.id}`}>
                          Mark Complete
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PerformanceTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Tasks Completed"
          value={67}
          subtitle="This month"
          icon={CheckCircle2}
          trend={{ value: "+12 vs last month", positive: true }}
        />
        <StatCard
          title="Avg Response Time"
          value="4.2h"
          subtitle="To member needs"
          icon={Clock}
          trend={{ value: "-1.5h improvement", positive: true }}
        />
        <StatCard
          title="Member Satisfaction"
          value="4.6"
          subtitle="Out of 5.0"
          icon={Heart}
        />
        <StatCard
          title="Caseload Capacity"
          value="72%"
          subtitle="28 of 39 slots"
          icon={Users}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Weekly Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockPerformanceData}>
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
                <Bar dataKey="completed" fill="#22C55E" radius={[4, 4, 0, 0]} name="Completed" />
                <Bar dataKey="pending" fill={LIME} radius={[4, 4, 0, 0]} name="Pending" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Reimbursement Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { metric: "Documented Encounters", value: 89, target: 100, pct: 89 },
                { metric: "SDOH Screenings", value: 45, target: 50, pct: 90 },
                { metric: "Care Plan Updates", value: 32, target: 40, pct: 80 },
                { metric: "Referral Completions", value: 23, target: 30, pct: 77 },
              ].map((item) => (
                <div key={item.metric} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{item.metric}</span>
                    <span className="text-sm text-muted-foreground">
                      {item.value}/{item.target}
                    </span>
                  </div>
                  <Progress value={item.pct} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Outcome Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={[
                    { month: "Aug", positive: 12, neutral: 5, negative: 2 },
                    { month: "Sep", positive: 15, neutral: 4, negative: 3 },
                    { month: "Oct", positive: 18, neutral: 6, negative: 1 },
                    { month: "Nov", positive: 22, neutral: 3, negative: 2 },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="month" stroke="#666" fontSize={12} />
                  <YAxis stroke="#666" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "#1A1A1A",
                      border: "1px solid #333",
                      borderRadius: "8px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="positive"
                    stackId="1"
                    stroke="#22C55E"
                    fill="rgba(34, 197, 94, 0.3)"
                  />
                  <Area
                    type="monotone"
                    dataKey="neutral"
                    stackId="1"
                    stroke="#EAB308"
                    fill="rgba(234, 179, 8, 0.3)"
                  />
                  <Area
                    type="monotone"
                    dataKey="negative"
                    stackId="1"
                    stroke={LIME}
                    fill={`${LIME}30`}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ProviderDashboard() {
  const [activeTab, setActiveTab] = useState("caseload");

  const { data: organizations, isLoading: orgsLoading } = useQuery<any[]>({
    queryKey: ["/api/dashboard/organizations"],
  });

  const orgId = organizations?.[0]?.id;

  const { data: orgMembers } = useQuery<any[]>({
    queryKey: ["/api/dashboard/organizations", orgId, "members"],
    enabled: !!orgId,
  });

  const isDemo = !orgId;
  const activeCases = orgMembers?.length ?? 28;

  if (orgsLoading) {
    return (
      <div className="min-h-screen app-ground flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-mint-200" />
          <p className="text-sm text-muted-foreground">Loading provider portal...</p>
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
                PROVIDER PORTAL
              </h1>
              <p className="text-sm text-muted-foreground">CHW / Case Manager Dashboard</p>
            </div>
            <div className="flex items-center gap-2">
              {isDemo && (
                <Badge variant="secondary" className="px-3 py-1" data-testid="badge-demo-mode">
                  DEMO
                </Badge>
              )}
              <Badge variant="secondary" className="px-3 py-1">
                {activeCases} Active Cases
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
                value="caseload"
                className="text-xs px-3 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                data-testid="tab-caseload"
              >
                Caseload
              </TabsTrigger>
              <TabsTrigger
                value="referrals"
                className="text-xs px-3 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                data-testid="tab-referrals"
              >
                Referrals
              </TabsTrigger>
              <TabsTrigger
                value="profiles"
                className="text-xs px-3 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                data-testid="tab-profiles"
              >
                Member Profiles
              </TabsTrigger>
              <TabsTrigger
                value="actions"
                className="text-xs px-3 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                data-testid="tab-actions"
              >
                Actions
              </TabsTrigger>
              <TabsTrigger
                value="performance"
                className="text-xs px-3 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                data-testid="tab-performance"
              >
                Performance
              </TabsTrigger>
            </TabsList>
          </ScrollArea>

          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <TabsContent value="caseload" className="mt-0">
              <CaseloadTab />
            </TabsContent>
            <TabsContent value="referrals" className="mt-0">
              <ReferralsTab />
            </TabsContent>
            <TabsContent value="profiles" className="mt-0">
              <MemberProfilesTab />
            </TabsContent>
            <TabsContent value="actions" className="mt-0">
              <ActionsTab />
            </TabsContent>
            <TabsContent value="performance" className="mt-0">
              <PerformanceTab />
            </TabsContent>
          </motion.div>
        </Tabs>
      </div>
    </div>
  );
}
