import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Map,
  CheckCircle2,
  Circle,
  BookOpen,
  Code,
  Calendar,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import {
  PersonalizedRoadmap,
  getLatestRoadmap,
} from '../services/reportService';

export const RoadmapPage: React.FC = () => {
  const location = useLocation();
  const [roadmap, setRoadmap] = useState<PersonalizedRoadmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if ((location.state as any)?.roadmap) {
      setRoadmap((location.state as any).roadmap);
      setLoading(false);
      return;
    }
    const fetchRoadmap = async () => {
      setLoading(true);
      try {
        const data = await getLatestRoadmap();
        setRoadmap(data);
      } catch (err) {
        console.error('Failed to load roadmap:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRoadmap();
  }, [location.state]);

  const toggleTask = (taskId: string) => {
    setCompletedTasks((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white">Synthesizing Milestone Roadmap...</h2>
        <p className="text-sm text-slate-400 mt-2">
          Generating step-by-step curriculum targeting your lowest scoring interview dimensions.
        </p>
      </div>
    );
  }

  if (!roadmap) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <Card glow="cyan" padding="lg" className="border-cyan-500/20">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto mb-4">
            <Map className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">No Roadmap Generated Yet</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto mb-6 leading-relaxed">
            Complete a mock interview in the Interview Room so our AI can analyze your knowledge gaps and build a personalized progression roadmap.
          </p>
          <Link to="/interview">
            <Button variant="primary" size="md">
              Start interview
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  // Calculate overall task completion percentage
  const allTasksCount = roadmap.milestones.reduce(
    (acc, m) => acc + m.actionable_tasks.length,
    0
  );
  const completedCount = Object.values(completedTasks).filter(Boolean).length;
  const progressPct = allTasksCount > 0 ? Math.round((completedCount / allTasksCount) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Personalized Career Roadmap
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Milestones curated to advance your interview performance.
          </p>
        </div>

        <Link to="/interview">
          <Button variant="primary" size="sm" className="flex items-center gap-1.5">
            Start interview <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </div>

      {/* Progress & Target Focus Card */}
      <Card glow="cyan" padding="lg" className="border-cyan-500/20 bg-slate-900/60">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
          <div className="sm:col-span-8 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
                Target Improvement Focus
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {roadmap.identified_weak_areas.map((area, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold"
                >
                  {area}
                </span>
              ))}
            </div>
            <p className="text-xs text-slate-400 pt-1">
              Curated sequentially to elevate your interview scores from candidate level to Senior L5 benchmark.
            </p>
          </div>

          <div className="sm:col-span-4 p-4 rounded-xl bg-black/40 border border-white/10 text-center">
            <div className="text-2xl font-black text-emerald-400">{progressPct}%</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Roadmap Completion</div>
            <div className="w-full bg-white/10 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-cyan-400 to-emerald-400 h-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              {completedCount} of {allTasksCount} tasks completed
            </div>
          </div>
        </div>
      </Card>

      {/* Vertical Milestones Timeline */}
      <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-3 sm:before:left-4 before:top-4 before:bottom-4 before:w-0.5 before:bg-gradient-to-b before:from-cyan-500 before:via-violet-500 before:to-emerald-500">
        {roadmap.milestones.map((milestone, idx) => {
          const isAdvanced = milestone.difficulty === 'Advanced';
          return (
            <motion.div
              key={milestone.milestone_id}
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="relative"
            >
              {/* Step indicator circle on line */}
              <div className="absolute -left-6 sm:-left-8 top-1.5 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-slate-900 border-2 border-cyan-400 flex items-center justify-center text-xs font-bold text-cyan-300 font-mono shadow-lg shadow-cyan-500/30">
                {milestone.step_number}
              </div>

              {/* Milestone Card */}
              <Card padding="lg" className="border-white/10 bg-slate-900/60 hover:border-cyan-500/30 transition-all">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
                      Step {milestone.step_number}
                    </span>
                    <Badge variant={isAdvanced ? 'rose' : 'cyan'} size="sm">
                      {milestone.difficulty}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                    <span>~{milestone.estimated_days} Days</span>
                  </div>
                </div>

                <h3 className="text-base sm:text-lg font-bold text-white mb-1">
                  {milestone.title}
                </h3>
                <div className="text-xs text-cyan-300 font-mono mb-4">
                  Target Competency: {milestone.target_skill}
                </div>

                {/* Actionable Tasks Checklist */}
                <div className="mb-4 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Actionable Learning Tasks
                  </div>
                  <div className="space-y-1.5">
                    {milestone.actionable_tasks.map((task, tIdx) => {
                      const taskId = `${milestone.milestone_id}-t${tIdx}`;
                      const isDone = !!completedTasks[taskId];
                      return (
                        <div
                          key={tIdx}
                          onClick={() => toggleTask(taskId)}
                          className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors text-xs select-none ${
                            isDone
                              ? 'bg-emerald-950/20 text-slate-400 line-through'
                              : 'bg-white/[0.02] hover:bg-white/[0.05] text-slate-200'
                          }`}
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                          ) : (
                            <Circle className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                          )}
                          <span>{task}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Recommended Resources & Capstone Project Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-white/5 text-xs">
                  {/* Resources */}
                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-1.5">
                    <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-cyan-400" /> Curated References
                    </div>
                    <ul className="list-disc list-inside text-slate-400 space-y-0.5">
                      {milestone.recommended_resources.map((res, rIdx) => (
                        <li key={rIdx} className="truncate">
                          {res}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Capstone Mini Project */}
                  <div className="p-3 rounded-lg bg-violet-950/20 border border-violet-500/20 space-y-1.5">
                    <div className="font-semibold text-violet-300 flex items-center gap-1.5">
                      <Code className="w-3.5 h-3.5 text-violet-400" /> Proof-of-Skill Capstone
                    </div>
                    <p className="text-slate-300 leading-relaxed">
                      {milestone.capstone_mini_project}
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default RoadmapPage;
