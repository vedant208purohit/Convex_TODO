"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

export default function Home() {
  const [todoTitle, setTodoTitle] = useState("");

  const todos = useQuery(api.todos.list);
  const createTodo = useMutation(api.todos.create);
  const toggleTodo = useMutation(api.todos.toggle);

  async function handleCreateTodo(e: React.FormEvent) {
    e.preventDefault();
    if (!todoTitle.trim()) return;

    await createTodo({
      title: todoTitle.trim(),
    });

    setTodoTitle("");
  }

  async function handleToggle(id: any, currentCompleted: boolean) {
    await toggleTodo({
      id,
      completed: !currentCompleted,
    });
  }

  return (
    <main
      style={{
        maxWidth: "600px",
        margin: "40px auto",
        padding: "24px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <h1 style={{ fontSize: "2rem", marginBottom: "8px" }}>Todo App</h1>
      <p style={{ color: "#666", marginBottom: "24px" }}>
        Default App / Company Application Boilerplate
      </p>

      <form onSubmit={handleCreateTodo} style={{ display: "flex", gap: "10px", marginBottom: "24px" }}>
        <input
          type="text"
          value={todoTitle}
          onChange={(e) => setTodoTitle(e.target.value)}
          placeholder="Enter todo..."
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: "6px",
            border: "1px solid #ccc",
            fontSize: "1rem",
          }}
        />
        <button
          type="submit"
          style={{
            padding: "10px 20px",
            borderRadius: "6px",
            border: "none",
            backgroundColor: "#0070f3",
            color: "white",
            fontSize: "1rem",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Add Todo
        </button>
      </form>

      <section>
        <h2 style={{ fontSize: "1.25rem", marginBottom: "12px" }}>Todos</h2>
        {todos === undefined ? (
          <p style={{ color: "#888" }}>Loading todos...</p>
        ) : todos.length === 0 ? (
          <p style={{ color: "#888" }}>No todos yet. Create one above!</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {todos.map((todo) => (
              <li
                key={todo._id}
                onClick={() => handleToggle(todo._id, todo.completed)}
                style={{
                  padding: "12px 16px",
                  marginBottom: "8px",
                  borderRadius: "6px",
                  backgroundColor: "#f5f5f5",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => {}}
                  style={{ width: "18px", height: "18px", cursor: "pointer" }}
                />
                <span
                  style={{
                    fontSize: "1rem",
                    textDecoration: todo.completed ? "line-through" : "none",
                    color: todo.completed ? "#888" : "#111",
                  }}
                >
                  {todo.title}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}