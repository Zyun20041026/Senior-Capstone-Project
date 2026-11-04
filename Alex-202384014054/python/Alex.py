# Alex 202384014054
# Course Task Tracker - first version
# The assignments below are sample data for testing.
# Saving to a JSON file is the next step.

from datetime import date

assignments = [
    {"course": "Capstone", "title": "Project README", "due": "2026-11-11", "done": False},
    {"course": "Math", "title": "Homework 3", "due": "2026-11-06", "done": False},
    {"course": "English", "title": "Essay draft", "due": "2026-11-02", "done": False},
    {"course": "History", "title": "Reading notes", "due": "2026-11-05", "done": True},
]


def show_pending(assignments):
    today = date.today()
    pending = [a for a in assignments if not a["done"]]
    pending.sort(key=lambda a: a["due"])

    print("Pending assignments:")
    for number, a in enumerate(pending, start=1):
        due = date.fromisoformat(a["due"])
        note = "  (OVERDUE)" if due < today else ""
        print(f"{number}. {a['course']}: {a['title']} - due {a['due']}{note}")
    print()


def mark_complete(assignments, title):
    for a in assignments:
        if a["title"] == title:
            a["done"] = True
            print(f"Marked complete: {title}")
            print()
            return
    print(f"Not found: {title}")
    print()


def show_summary(assignments):
    total = len(assignments)
    completed = sum(1 for a in assignments if a["done"])
    rate = completed / total
    print(f"Completed {completed} of {total} ({rate:.0%})")


show_pending(assignments)
mark_complete(assignments, "Homework 3")
show_pending(assignments)
show_summary(assignments)
