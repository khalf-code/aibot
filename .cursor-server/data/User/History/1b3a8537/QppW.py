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

def add_project(args):
    conn = connect()
    cur = conn.cursor()
    project_id = str(uuid.uuid4())
    
    deadline = None
    if args.deadline:
        try:
            deadline = int(datetime.fromisoformat(args.deadline).timestamp())
        except:
            print(f"Error: Invalid date format: {args.deadline}")
            return

    cur.execute(
        "INSERT INTO projects (id, name, area_id, goal, deadline) VALUES (?, ?, ?, ?, ?)",
        (project_id, args.name, args.area, args.goal, deadline)
    )
    conn.commit()
    conn.close()
    print(f"🚀 Project created: {args.name} (ID: {project_id[:8]})")

def list_projects(args):
    conn = connect()
    cur = conn.cursor()
    
    cur.execute("SELECT p.id, p.name, a.name, p.status, p.deadline FROM projects p LEFT JOIN areas a ON p.area_id = a.id WHERE p.status = 'active'")
    rows = cur.fetchall()
    
    if not rows:
        print("No active projects found.")
    else:
        print(f"{'ID':<10} {'NAME':<30} {'AREA':<15} {'STATUS':<10} {'DEADLINE'}")
        print("-" * 80)
        for row in rows:
            pid, name, area, status, deadline = row
            dl_str = datetime.fromtimestamp(deadline).strftime('%Y-%m-%d') if deadline else "-"
            print(f"{pid[:8]:<10} {name[:28]:<30} {area[:13]:<15} {status:<10} {dl_str}")
            
    conn.close()

def main():
    parser = argparse.ArgumentParser(description="Liam PARA Project Manager")
    subparsers = parser.add_subparsers(dest="command")
    
    # Add
    add_parser = subparsers.add_parser("add")
    add_parser.add_argument("name")
    add_parser.add_argument("--area", "-a")
    add_parser.add_argument("--goal", "-g")
    add_parser.add_argument("--deadline", "-d")
    
    # List
    list_parser = subparsers.add_parser("list")
    
    args = parser.parse_args()
    
    if args.command == "add":
        add_project(args)
    elif args.command == "list":
        list_projects(args)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
