# Decision Spinner

A micro-tool for ADHD paralysis moments.

## Problem
Too many options → freeze → nothing happens.

## Solution
Externalize the decision. Let the spinner carry the weight.

## Modes
1. **Random** — Pure chance, equal weights
2. **Weighted** — You assign importance, spinner respects it
3. **Elimination** — Round by round, remove options until one remains
4. **Body Check** — Each option gets a gut-reaction score (1-10), highest wins

## Usage
```bash
python spinner.py "Option A" "Option B" "Option C"
# or
python spinner.py --mode elimination "Pizza" "Sushi" "Tacos" "Salad"
```

## Philosophy
Not about making the "right" choice. About making *a* choice and moving forward.
