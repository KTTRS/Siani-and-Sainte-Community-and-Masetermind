import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fadeUp, SPRING, EASE } from "@/lib/motion";
import { Plus, Check, MoreHorizontal, Sparkles } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { haptic } from "@/lib/haptics";
import { playCommit } from "@/lib/useSound";

interface Move {
  id: string;
  title: string;
  weight: "light" | "medium" | "heavy";
  status: "pending" | "completed";
  createdAt: Date;
}

const WEIGHT_LABELS = {
  light: "Light",
  medium: "Medium", 
  heavy: "Heavy",
};

const WEIGHT_COLORS = {
  light: "bg-forest-3/50 text-earth-3 border-forest-4/40",
  medium: "bg-primary/20 text-primary-foreground border-primary/30",
  heavy: "bg-forest-2/80 text-earth-1 border-forest-4/50",
};

export default function Moves() {
  const [isAddingMove, setIsAddingMove] = useState(false);
  const [newMoveTitle, setNewMoveTitle] = useState("");
  const [newMoveWeight, setNewMoveWeight] = useState<"light" | "medium" | "heavy">("light");
  const { toast } = useToast();

  const [moves, setMoves] = useState<Move[]>([
    {
      id: "1",
      title: "Call about that food assistance thing",
      weight: "heavy",
      status: "pending",
      createdAt: new Date(),
    },
    {
      id: "2", 
      title: "Text back my cousin",
      weight: "light",
      status: "pending",
      createdAt: new Date(),
    },
  ]);

  const handleAddMove = () => {
    if (!newMoveTitle.trim()) return;
    
    if (moves.filter(m => m.status === "pending").length >= 3) {
      haptic('warn');
      toast({
        title: "Three moves max",
        description: "Complete one first, or let one go. You got this.",
      });
      return;
    }
    haptic('click');

    const newMove: Move = {
      id: `move-${Date.now()}`,
      title: newMoveTitle,
      weight: newMoveWeight,
      status: "pending",
      createdAt: new Date(),
    };

    setMoves([...moves, newMove]);
    setNewMoveTitle("");
    setNewMoveWeight("light");
    setIsAddingMove(false);

    toast({
      description: "Move added. You know what you need to do.",
    });
  };

  const handleCompleteMove = (id: string) => {
    haptic('success');
    void playCommit();
    setMoves(moves.map(m => 
      m.id === id ? { ...m, status: "completed" as const } : m
    ));
    
    const move = moves.find(m => m.id === id);
    toast({
      description: move?.weight === "heavy" 
        ? "That was a heavy one. You handled it. Respect."
        : "Move complete. That's how it's done.",
    });
  };

  const pendingMoves = moves.filter(m => m.status === "pending");
  const completedMoves = moves.filter(m => m.status === "completed");

  return (
    <div className="flex flex-col h-full bg-background pb-20">
      {/* Header */}
      <header className="px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-broken-display text-2xl text-foreground">Moves</h1>
            <p className="font-condensed text-sm text-muted-foreground mt-1">
              Your 1-3 things for today. Not tasks. Moves.
            </p>
          </div>
          <Dialog open={isAddingMove} onOpenChange={setIsAddingMove}>
            <DialogTrigger asChild>
              <Button 
                size="icon" 
                className="rounded-full"
                disabled={pendingMoves.length >= 3}
                data-testid="button-add-move"
              >
                <Plus className="w-5 h-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add a Move</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  placeholder="What are you doing today?"
                  value={newMoveTitle}
                  onChange={(e) => setNewMoveTitle(e.target.value)}
                  className="text-base"
                  data-testid="input-move-title"
                />
                <Select value={newMoveWeight} onValueChange={(v) => setNewMoveWeight(v as any)}>
                  <SelectTrigger data-testid="select-move-weight">
                    <SelectValue placeholder="How heavy is this?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light - quick and easy</SelectItem>
                    <SelectItem value="medium">Medium - takes some effort</SelectItem>
                    <SelectItem value="heavy">Heavy - big deal</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  onClick={handleAddMove} 
                  className="w-full"
                  disabled={!newMoveTitle.trim()}
                  data-testid="button-confirm-add-move"
                >
                  Add Move
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Progress indicator */}
        <div className="flex gap-2 mt-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < pendingMoves.length
                  ? "bg-primary"
                  : "bg-muted"
              }`}
            />
          ))}
        </div>
      </header>

      {/* Moves list */}
      <div className="flex-1 px-4 overflow-auto">
        {pendingMoves.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-display text-lg text-foreground mb-2">
              No moves yet
            </h3>
            <p className="text-muted-foreground max-w-xs">
              Add what you need to handle today. Keep it to 3 max.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {pendingMoves.map((move, index) => (
                <motion.div
                  key={move.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 100, scale: 0.9 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card
                    className="matte-3d p-4 hover-elevate cursor-pointer"
                    onClick={() => handleCompleteMove(move.id)}
                    data-testid={`card-move-${move.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="mt-0.5 w-6 h-6 rounded-full border-2 border-primary flex items-center justify-center shrink-0"
                        data-testid={`button-complete-move-${move.id}`}
                      >
                        <Check className="w-3.5 h-3.5 text-primary opacity-0 group-hover:opacity-100" />
                      </motion.button>
                      <div className="flex-1 min-w-0">
                        <p className="font-display text-base text-foreground">
                          {move.title}
                        </p>
                        <Badge 
                          variant="outline" 
                          className={`mt-2 text-xs ${WEIGHT_COLORS[move.weight]}`}
                        >
                          {WEIGHT_LABELS[move.weight]}
                        </Badge>
                      </div>
                      <Button variant="ghost" size="icon" className="shrink-0">
                        <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Completed moves */}
        {completedMoves.length > 0 && (
          <div className="mt-8">
            <h3 className="font-condensed text-sm text-muted-foreground mb-3">
              Handled Today
            </h3>
            <div className="space-y-2">
              {completedMoves.map((move) => (
                <Card
                  key={move.id}
                  className="p-3 border-border/30 bg-card/50"
                  data-testid={`card-completed-move-${move.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground line-through">
                      {move.title}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
