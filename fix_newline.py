from pathlib import Path
path = Path('frontend/src/hooks/useOffline.ts')
text = path.read_text(encoding='utf-8')
text = text.replace('  }, []);\\r\\n\\r\\n  const registerServiceWorker', '  }, []);\n\n  const registerServiceWorker')
path.write_text(text, encoding='utf-8')
