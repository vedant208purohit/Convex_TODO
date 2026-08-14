import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
    args: {
        title: v.string(),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("todos", {
            title: args.title,
            completed: false,
        });
    },
});

export const list = query({
    handler: async (ctx) => {
        return await ctx.db.query("todos").collect();
    },
});

export const toggle = mutation({
    args: {
        id: v.id("todos"),
        completed: v.boolean(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, {
            completed: args.completed,
        });
    },
});