import json

with open('monday_board_structure.json', 'r') as f:
    data = json.load(f)

# Find Budget Pet Products
boards = data.get('data', {}).get('boards', [])
for board in boards:
    for group in board.get('groups', []):
        items = group.get('items_page', {}).get('items', [])
        for item in items:
            name = item.get('name', '')
            if 'budget pet' in name.lower():
                print(f"Found: {name}")
                for col in item.get('column_values', []):
                    title = col.get('column', {}).get('title', '')
                    text = col.get('text')
                    value = col.get('value')
                    if value:
                        value = value[:100] + '...' if len(value) > 100 else value
                    print(f"  {title}: text={text}, value={value}")
