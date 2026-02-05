import { describe, it, expect, beforeEach } from "vitest";
import type { Track, TaskDefinition, Worker, Message, ReviewQueueItem } from "../types";
import {
  useDashboardStore,
  selectCurrentTrack,
  selectPendingReviews,
  selectActiveWorkers,
  selectTasksByTrack,
  selectMessagesForTrack,
} from "./dashboardStore";

// Reset store between tests
beforeEach(() => {
  useDashboardStore.setState({
    connected: false,
    connecting: false,
    error: null,
    tracks: [],
    tasks: [],
    workers: [],
    messages: [],
    reviews: [],
    worktrees: [],
    selectedTrackId: null,
    selectedTaskId: null,
    selectedReviewId: null,
    sidebarCollapsed: false,
    contextPanelOpen: true,
  });
});

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------

describe("track management", () => {
  const track: Track = {
    id: "t-1",
    name: "Test Track",
    description: "A test",
    status: "active",
    taskCount: 0,
    completedTaskCount: 0,
  };

  it("adds and retrieves a track", () => {
    useDashboardStore.getState().addTrack(track);
    expect(useDashboardStore.getState().tracks).toHaveLength(1);
    expect(useDashboardStore.getState().tracks[0].name).toBe("Test Track");
  });

  it("updates a track", () => {
    useDashboardStore.getState().addTrack(track);
    useDashboardStore.getState().updateTrack("t-1", { status: "completed" });
    expect(useDashboardStore.getState().tracks[0].status).toBe("completed");
  });

  it("removes a track and clears selection", () => {
    useDashboardStore.getState().addTrack(track);
    useDashboardStore.getState().selectTrack("t-1");
    useDashboardStore.getState().removeTrack("t-1");
    expect(useDashboardStore.getState().tracks).toHaveLength(0);
    expect(useDashboardStore.getState().selectedTrackId).toBeNull();
  });

  it("selectCurrentTrack returns correct track", () => {
    useDashboardStore.getState().addTrack(track);
    useDashboardStore.getState().selectTrack("t-1");
    expect(selectCurrentTrack(useDashboardStore.getState())).toEqual(track);
  });
});

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

describe("task management", () => {
  const task: TaskDefinition = {
    id: "task-1",
    trackId: "track-1",
    title: "Test task",
    description: "Do something",
    workerType: "code",
    status: "pending",
    requiresReview: false,
    maxRetries: 0,
    timeoutMinutes: 30,
  };

  it("adds a task", () => {
    useDashboardStore.getState().addTask(task);
    expect(useDashboardStore.getState().tasks).toHaveLength(1);
  });

  it("updates a task", () => {
    useDashboardStore.getState().addTask(task);
    useDashboardStore.getState().updateTask("task-1", { status: "running" });
    expect(useDashboardStore.getState().tasks[0].status).toBe("running");
  });

  it("removes a task and clears selection", () => {
    useDashboardStore.getState().addTask(task);
    useDashboardStore.getState().selectTask("task-1");
    useDashboardStore.getState().removeTask("task-1");
    expect(useDashboardStore.getState().tasks).toHaveLength(0);
    expect(useDashboardStore.getState().selectedTaskId).toBeNull();
  });

  it("selectTasksByTrack filters correctly", () => {
    useDashboardStore.getState().addTask(task);
    useDashboardStore.getState().addTask({ ...task, id: "task-2", trackId: "track-2" });
    const result = selectTasksByTrack(useDashboardStore.getState(), "track-1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("task-1");
  });
});

// ---------------------------------------------------------------------------
// Workers
// ---------------------------------------------------------------------------

describe("worker management", () => {
  const worker: Worker = {
    id: "w-1",
    name: "Worker 1",
    type: "code",
    status: "idle",
  };

  it("sets and updates workers", () => {
    useDashboardStore.getState().setWorkers([worker]);
    useDashboardStore.getState().updateWorker("w-1", { status: "active", currentTask: "task-1" });
    const updated = useDashboardStore.getState().workers[0];
    expect(updated.status).toBe("active");
    expect(updated.currentTask).toBe("task-1");
  });

  it("selectActiveWorkers filters correctly", () => {
    useDashboardStore
      .getState()
      .setWorkers([worker, { ...worker, id: "w-2", name: "Worker 2", status: "active" }]);
    expect(selectActiveWorkers(useDashboardStore.getState())).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

describe("message management", () => {
  const message: Message = {
    id: "msg-1",
    content: "Hello",
    sender: "user",
    senderName: "Operator",
    timestamp: Date.now(),
    trackId: "track-1",
  };

  it("adds a message", () => {
    useDashboardStore.getState().addMessage(message);
    expect(useDashboardStore.getState().messages).toHaveLength(1);
  });

  it("selectMessagesForTrack filters correctly", () => {
    useDashboardStore.getState().addMessage(message);
    useDashboardStore.getState().addMessage({ ...message, id: "msg-2", trackId: "track-2" });
    expect(selectMessagesForTrack(useDashboardStore.getState(), "track-1")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

describe("review management", () => {
  const review: ReviewQueueItem = {
    id: "rev-1",
    taskId: "task-1",
    trackId: "track-1",
    title: "Review this",
    description: "Please review",
    status: "pending",
    createdAt: Date.now(),
    diffStats: { filesChanged: 1, additions: 10, deletions: 5 },
    comments: [],
  };

  it("adds and updates a review", () => {
    useDashboardStore.getState().addReview(review);
    useDashboardStore.getState().updateReview("rev-1", { status: "approved" });
    expect(useDashboardStore.getState().reviews[0].status).toBe("approved");
  });

  it("selectPendingReviews filters correctly", () => {
    useDashboardStore.getState().addReview(review);
    useDashboardStore.getState().addReview({ ...review, id: "rev-2", status: "approved" });
    expect(selectPendingReviews(useDashboardStore.getState())).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// UI State
// ---------------------------------------------------------------------------

describe("UI state", () => {
  it("toggles sidebar", () => {
    expect(useDashboardStore.getState().sidebarCollapsed).toBe(false);
    useDashboardStore.getState().toggleSidebar();
    expect(useDashboardStore.getState().sidebarCollapsed).toBe(true);
    useDashboardStore.getState().toggleSidebar();
    expect(useDashboardStore.getState().sidebarCollapsed).toBe(false);
  });

  it("toggles context panel", () => {
    expect(useDashboardStore.getState().contextPanelOpen).toBe(true);
    useDashboardStore.getState().toggleContextPanel();
    expect(useDashboardStore.getState().contextPanelOpen).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// applySnapshot
// ---------------------------------------------------------------------------

describe("applySnapshot", () => {
  it("applies a full snapshot", () => {
    const track: Track = {
      id: "t-1",
      name: "T",
      description: "",
      status: "active",
      taskCount: 0,
      completedTaskCount: 0,
    };
    useDashboardStore.getState().applySnapshot({
      tracks: [track],
      tasks: [],
      workers: [],
      messages: [],
      reviews: [],
      worktrees: [],
    });
    expect(useDashboardStore.getState().tracks).toEqual([track]);
  });

  it("only updates fields present in snapshot", () => {
    const track: Track = {
      id: "t-1",
      name: "T",
      description: "",
      status: "active",
      taskCount: 0,
      completedTaskCount: 0,
    };
    useDashboardStore.getState().addTrack(track);
    useDashboardStore.getState().applySnapshot({ messages: [] });
    // tracks should remain unchanged
    expect(useDashboardStore.getState().tracks).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Gateway Events
// ---------------------------------------------------------------------------

describe("handleGatewayEvent", () => {
  it("handles dashboard.message event", () => {
    const message: Message = {
      id: "msg-1",
      content: "hello",
      sender: "user",
      senderName: "Test",
      timestamp: Date.now(),
    };
    useDashboardStore.getState().handleGatewayEvent({
      type: "dashboard.message",
      timestamp: Date.now(),
      payload: message,
    });
    expect(useDashboardStore.getState().messages).toHaveLength(1);
    expect(useDashboardStore.getState().messages[0].content).toBe("hello");
  });

  it("handles dashboard.task.updated event", () => {
    const task: TaskDefinition = {
      id: "task-1",
      trackId: "track-1",
      title: "Test",
      description: "",
      workerType: "code",
      status: "pending",
      requiresReview: false,
      maxRetries: 0,
      timeoutMinutes: 30,
    };
    useDashboardStore.getState().addTask(task);
    useDashboardStore.getState().handleGatewayEvent({
      type: "dashboard.task.updated",
      timestamp: Date.now(),
      payload: { taskId: "task-1", updates: { status: "complete" } },
    });
    expect(useDashboardStore.getState().tasks[0].status).toBe("complete");
  });

  it("handles dashboard.review.resolved event", () => {
    const review: ReviewQueueItem = {
      id: "rev-1",
      taskId: "task-1",
      trackId: "track-1",
      title: "Review",
      description: "",
      status: "pending",
      createdAt: Date.now(),
      diffStats: { filesChanged: 0, additions: 0, deletions: 0 },
      comments: [],
    };
    useDashboardStore.getState().addReview(review);
    useDashboardStore.getState().handleGatewayEvent({
      type: "dashboard.review.resolved",
      timestamp: Date.now(),
      payload: { reviewId: "rev-1", decision: "approved", comment: "LGTM" },
    });
    const resolved = useDashboardStore.getState().reviews[0];
    expect(resolved.status).toBe("approved");
    expect(resolved.reviewedAt).toBeDefined();
    expect(resolved.comments).toHaveLength(1);
    expect(resolved.comments[0].content).toBe("LGTM");
  });

  it("handles task.created event", () => {
    const task: TaskDefinition = {
      id: "task-new",
      trackId: "track-1",
      title: "New Task",
      description: "",
      workerType: "code",
      status: "pending",
      requiresReview: false,
      maxRetries: 0,
      timeoutMinutes: 30,
    };
    useDashboardStore.getState().handleGatewayEvent({
      type: "task.created",
      timestamp: Date.now(),
      payload: task,
    });
    expect(useDashboardStore.getState().tasks).toHaveLength(1);
  });

  it("handles worker.status event", () => {
    const worker: Worker = { id: "w-1", name: "W1", type: "code", status: "idle" };
    useDashboardStore.getState().setWorkers([worker]);
    useDashboardStore.getState().handleGatewayEvent({
      type: "worker.status",
      timestamp: Date.now(),
      payload: { workerId: "w-1", status: "active", currentTask: "task-1" },
    });
    expect(useDashboardStore.getState().workers[0].status).toBe("active");
  });
});
