# -*- coding: utf-8 -*-
from pathlib import Path

path = Path('frontend/src/hooks/useOffline.ts')
lines = path.read_text(encoding='utf-8').splitlines()

# ensure blank line between effect and function
for idx, line in enumerate(lines):
    if line.strip() == 'void registerServiceWorker();':
        # The next line should be "}, []);" and then register function
        if idx + 1 < len(lines) and lines[idx + 1].strip() == '}, []);':
            insert_pos = idx + 2
            # remove existing blank lines and ensure two blank lines followed by function
            while insert_pos < len(lines) and lines[insert_pos].strip() == '':
                insert_pos += 1
            # do nothing; blank lines already there
        break

# but the display issue persists because of escape sequences that do not exist; skip

path.write_text('\n'.join(lines) + '\n', encoding='utf-8')
