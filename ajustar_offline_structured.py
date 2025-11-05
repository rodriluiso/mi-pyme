# -*- coding: utf-8 -*-
from pathlib import Path

path = Path('frontend/src/hooks/useOffline.ts')
lines = path.read_text(encoding='utf-8').splitlines()

# replace initial state
def replace_initial_state():
    for idx, line in enumerate(lines):
        if line.strip().startswith('const [state, setState] = useState<OfflineState>('):
            lines[idx:idx+6] = [
                "  const isServiceWorkerSupported = typeof navigator !== 'undefined' and 'serviceWorker' in navigator;",
                "  const [state, setState] = useState<OfflineState>({",
                "    isOnline: navigator.onLine,",
                "    isOfflineCapable: isServiceWorkerSupported and import.meta.env.PROD,",
                "    pendingOperations: 0,",
                "    lastSyncTime: null,",
                "  });"
            ]
            return True
    return False

# replace useEffect block after comment

def replace_use_effect():
    for idx, line in enumerate(lines):
        if line.strip() == '// Configurar Service Worker':
            effect_idx = idx + 1
            replacement = [
                "  useEffect(() => {",
                "    if (!('serviceWorker' in navigator)) {",
                "      return;",
                "    }",
                "",
                "    if (import.meta.env.DEV) {",
                "      navigator.serviceWorker.getRegistrations().then(registros => {",
                "        registros.forEach(registro => registro.unregister());",
                "      }).catch(error => {",
                "        console.warn('No fue posible limpiar los service workers previos', error);",
                "      });",
                "      setState(prev => ({ ...prev, isOfflineCapable: false }));",
                "      return;",
                "    }",
                "",
                "    registerServiceWorker();",
                "  }, []);"
            ]
            lines[effect_idx:effect_idx+4] = replacement
            return True
    return False

# insert guard in registerServiceWorker
def adjust_register_function():
    for idx, line in enumerate(lines):
        if line.strip().startswith('const registerServiceWorker = async () => {'):
            lines.insert(idx+1, "    if (!import.meta.env.PROD):\n      return")
            return True
    return False

if not replace_initial_state():
    raise SystemExit('estado inicial no encontrado')
if not replace_use_effect():
    raise SystemExit('useEffect no encontrado')
if not adjust_register_function():
    raise SystemExit('registerServiceWorker no encontrado')

path.write_text('\n'.join(lines) + '\n', encoding='utf-8')
