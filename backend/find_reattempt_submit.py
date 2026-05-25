with open("f:/Projects/NEET STUDENT APP/frontend/src/App.jsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "const handleReattemptSubmit" in line:
        print(f"Line {i+1}: {line.strip()}")
        # print subsequent 15 lines
        for j in range(i+1, min(len(lines), i+16)):
            print(f"  Line {j+1}: {lines[j].strip()}")
        break
