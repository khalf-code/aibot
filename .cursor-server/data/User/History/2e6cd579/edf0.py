#!/usr/bin/env python3
import sqlite3
import argparse
import sys
import uuid
import time
from datetime import datetime

DB_PATH = '/home/liam/clawd/memory/para.sqlite'

def connect():
    return sqlite3.connect(DB_PATH)

def add_task(args):
    conn = connect()
    cur = conn.cursor()
    task_id = str(uuid.uuid4())
    
    # Simple relative date parsing for due_date (e.g. "+2d")
    due_date = None
    if args.due:
        if args.due.startswith('+'):
            days = int(args.due[1:-1]) # assume format +Nd
            due_date = int(time.time()) + (days * 86400)
        else:
            try:
                due_date = int(datetime.fromisoformat(args.due).timestamp())
            except:
                print(f"Error: Invalid date format: {args.due}")
                return

    cur.execute(
        "INSERT INTO tasks (id, title, description, category, project_id, priority, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (task_id, args.title, args.description, args.category, args.project, args.priority, due_date)
    )
    conn.commit()
    conn.close()
    print(f"✅ Task added: {args.title} (ID: {task_id[:8]})")

def list_tasks(args):
    conn = connect()
    cur = conn.cursor()
    
    query = "SELECT t.id, t.title, t.category, t.status, t.due_date, p.name FROM tasks t LEFT JOIN projects p ON t.project_id = p.id WHERE t.status != 'completed' AND t.status != 'cancelled'"
    params = []
    
    if args.category:
        query += " AND t.category = ?"
        params.append(args.category)
        
    query += " ORDER BY t.priority ASC, t.due_date ASC"
    
    cur.execute(query, params)
    rows = cur.fetchall()
    
    if not rows:
        print("No active tasks found.")
    else:
        print(f"{'ID':<10} {'TITLE':<40} {'CAT':<5} {'STATUS':<12} {'DUE'}")
        print("-" * 80)
        for row in rows:
            tid, title, cat, status, due, proj = row
            due_str = datetime.fromtimestamp(due).strftime('%Y-%m-%d') if due else "-"
            print(f"{tid[:8]:<10} {title[:38]:<40} {cat:<5} {status:<12} {due_str}")
            
    conn.close()

def complete_task(args):
    conn = connect()
    cur = conn.cursor()
    cur.execute("UPDATE tasks SET status = 'completed', updated_at = ? WHERE id LIKE ?", (int(time.time()), args.id + '%'))
    if cur.rowcount > 0:
        print(f"✅ Task marked as completed.")
    else:
        print(f"❌ Task not found: {args.id}")
    conn.commit()
    conn.close()

def main():
    parser = argparse.ArgumentParser(description="Liam PARA Task Manager")
    subparsers = parser.add_subparsers(dest="command")
    
    # Add
    add_parser = subparsers.add_parser("add")
    add_parser.add_argument("title")
    add_parser.add_argument("--description", "-d")
    add_parser.add_argument("--category", "-c", choices=['P', 'A', 'R', 'X'], default='P')
    add_parser.add_argument("--project", "-p")
    add_parser.add_argument("--priority", type=int, default=3)
    add_parser.add_argument("--due")
    
    # List
    list_parser = subparsers.add_parser("list")
    list_parser.add_argument("--category", "-c")
    
    # Done
    done_parser = subparsers.add_parser("done")
    done_parser.add_argument("id")
    
    args = parser.parse_args()
    
    if args.command == "add":
        add_task(args)
    elif args.command == "list":
        list_tasks(args)
    elif args.command == "done":
        complete_task(args)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
