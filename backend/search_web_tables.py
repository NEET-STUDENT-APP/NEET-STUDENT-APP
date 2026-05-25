with open("f:/Projects/NEET STUDENT APP/frontend/src/App.jsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "Result Status" in line or "Selected Option" in line or "Time Spent" in line:
        print(f"Line {i+1}: {line.strip()}")
        # print around the line
        for j in range(max(0, i-4), min(len(lines), i+15)):
            print(f"  Line {j+1}: {lines[j].strip()}")
        print("-" * 50)
