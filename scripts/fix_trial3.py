with open('app/at/hub/page.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"Total lines: {len(lines)}")
# Find start line (0-indexed) - look for "Trial overlay" comment
start = None
end = None
for i, l in enumerate(lines):
    if 'Trial overlay' in l:
        start = i
    if start is not None and 'Trial resolved banner' in l:
        end = i
        break

print(f"Start line (0-idx): {start}, End line (0-idx): {end}")
if start is None or end is None:
    print("Not found")
    exit(1)

print("Old section preview:")
print(repr(lines[start][:80]))
print(repr(lines[end][:50]))
