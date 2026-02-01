#!/usr/bin/env python3
"""
Decision Spinner - For ADHD paralysis moments
"""

import random
import sys
import argparse
from typing import List, Tuple

def random_choice(options: List[str]) -> str:
    """Pure random selection."""
    return random.choice(options)

def weighted_choice(options: List[str]) -> str:
    """Ask user to assign weights, then select."""
    print("\nAssign importance (1-10) for each option:")
    weights = []
    for opt in options:
        while True:
            try:
                w = int(input(f"  {opt}: "))
                if 1 <= w <= 10:
                    weights.append(w)
                    break
                print("    Please enter 1-10")
            except ValueError:
                print("    Please enter a number")
    
    # Weighted random selection
    total = sum(weights)
    r = random.uniform(0, total)
    cumsum = 0
    for opt, w in zip(options, weights):
        cumsum += w
        if r <= cumsum:
            return opt
    return options[-1]

def elimination_round(options: List[str]) -> str:
    """Eliminate options round by round."""
    current = options.copy()
    round_num = 1
    
    while len(current) > 1:
        print(f"\n--- Round {round_num} ---")
        print(f"Remaining: {', '.join(current)}")
        
        # Randomly eliminate one
        to_eliminate = random.choice(current)
        current.remove(to_eliminate)
        print(f"Eliminated: {to_eliminate}")
        
        if len(current) > 1:
            input("Press Enter to continue...")
        round_num += 1
    
    return current[0]

def body_check(options: List[str]) -> str:
    """Gut reaction scoring."""
    print("\nQuick gut check: Rate your excitement for each (1-10, first instinct):")
    scores = []
    for opt in options:
        while True:
            try:
                s = int(input(f"  {opt}: "))
                if 1 <= s <= 10:
                    scores.append(s)
                    break
                print("    1-10 please")
            except ValueError:
                print("    Number please")
    
    # Find highest score
    max_score = max(scores)
    best_options = [opt for opt, s in zip(options, scores) if s == max_score]
    
    if len(best_options) == 1:
        return best_options[0]
    else:
        print(f"\nTie between: {', '.join(best_options)}")
        print("Letting fate decide...")
        return random.choice(best_options)

def main():
    parser = argparse.ArgumentParser(
        description="Decision Spinner - For when you can't choose",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python spinner.py "Pizza" "Sushi" "Tacos"
  python spinner.py --mode weighted "Option A" "Option B" "Option C"
  python spinner.py --mode elimination "A" "B" "C" "D" "E"
        """
    )
    parser.add_argument(
        "options",
        nargs="+",
        help="Options to choose from"
    )
    parser.add_argument(
        "--mode",
        choices=["random", "weighted", "elimination", "body"],
        default="random",
        help="Selection mode (default: random)"
    )
    
    args = parser.parse_args()
    
    if len(args.options) < 2:
        print("Need at least 2 options to choose from.")
        sys.exit(1)
    
    print(f"\n🎯 Decision Spinner ({args.mode} mode)")
    print(f"Options: {', '.join(args.options)}")
    print("Spinning...")
    
    if args.mode == "random":
        result = random_choice(args.options)
    elif args.mode == "weighted":
        result = weighted_choice(args.options)
    elif args.mode == "elimination":
        result = elimination_round(args.options)
    elif args.mode == "body":
        result = body_check(args.options)
    
    print(f"\n✨ Result: {result}")
    print("\n(Remember: There are no wrong choices, only paths forward.)")

if __name__ == "__main__":
    main()
