const ComprasPageDebug = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Compras - Debug</h1>
      <p>Esta es una página de debug para verificar que el routing funciona correctamente.</p>
      <div style={{ border: '1px solid #ccc', padding: '10px', marginTop: '20px' }}>
        <h2>Estado de la aplicación:</h2>
        <ul>
          <li>✅ Frontend está corriendo</li>
          <li>✅ Backend está corriendo</li>
          <li>✅ Rutas están configuradas</li>
          <li>❓ ComprasPage tiene algún error</li>
        </ul>
      </div>
    </div>
  );
};

export default ComprasPageDebug;