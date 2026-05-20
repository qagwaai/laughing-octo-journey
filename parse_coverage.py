import os
import re
from bs4 import BeautifulSoup

def get_coverage_from_html(html_path, base_dir=""):
    with open(html_path, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f, 'html.parser')
    
    rows = soup.find_all('tr')[1:] # Skip header
    results = []
    
    for row in rows:
        file_td = row.find('td', class_='file')
        if not file_td:
            continue
        
        file_name = file_td.get('data-value')
        
        # Branch coverage is the 3rd <td> with data-value or check pct class
        tds = row.find_all('td')
        # Based on index.html: 
        # 0: File, 1: Pic, 2: Statements Pct, 3: Statements Abs, 
        # 4: Branches Pct, 5: Branches Abs, 6: Functions Pct, ...
        
        try:
            branch_pct = float(tds[4].get('data-value'))
        except (IndexError, ValueError, TypeError):
            branch_pct = 100.0
            
        full_path = os.path.join(base_dir, file_name).replace('\\', '/')
        results.append((full_path, branch_pct))
    return results

all_results = []
# Start with root
all_results.extend(get_coverage_from_html('coverage/ngt-template/index.html'))

# Crawl subdirectories
for root, dirs, files in os.walk('coverage/ngt-template'):
    if 'index.html' in files:
        rel_path = os.path.relpath(root, 'coverage/ngt-template')
        if rel_path == '.':
            continue
        all_results.extend(get_coverage_from_html(os.path.join(root, 'index.html'), rel_path))

# Filter out directories (they end with /index.html in the results usually, but we want files)
# In Istanbul/nyc, index.html lists files and directories. 
# Files usually end in .ts or .js or similar. Directories don't.
final_files = [res for res in all_results if res[0].endswith(('.ts', '.js', '.html', '.scss'))]

# Sort by branch coverage
final_files.sort(key=lambda x: (not x[0].startswith('app/page/game'), x[1]))

# Output top 15
for path, pct in final_files[:15]:
    print(f"{path}: {pct}%")
