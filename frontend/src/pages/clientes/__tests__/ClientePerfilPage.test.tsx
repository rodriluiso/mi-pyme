import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ClientePerfilPage from "@/pages/clientes/ClientePerfilPage";
import type { PerfilClienteResponse } from "@/types/mipyme";

const mockRequest = vi.fn();

vi.mock("@/hooks/useApi", () => ({
  useApi: () => ({
    request: mockRequest
  })
}));

describe("ClientePerfilPage", () => {
  const perfilMock: PerfilClienteResponse = {
    cliente: {
      id: 1,
      nombre: "Cliente Demo",
      identificacion: "20123456789",
      correo: "demo@mipyme.com",
      telefono: "1112345678",
      direccion: "Av. Siempre Viva",
      saldo: "1000.00"
    },
    historial_ventas: [
      { id: 10, fecha: "2025-09-20", total: "1500.00" }
    ],
    historial_compras: [
      { id: 5, fecha: "2025-08-15", total: "800.00" }
    ],
    pagos: [
      { id: 3, fecha: "2025-09-21", monto: "500.00", medio: "TRANSFERENCIA" }
    ],
    saldo: "1000.00",
    total_ventas: "1500.00",
    total_compras: "800.00",
    total_pagos: "500.00"
  };

  beforeEach(() => {
    mockRequest.mockReset();
    mockRequest.mockResolvedValue(perfilMock);
  });

  it("muestra los datos del perfil y permite recargar", async () => {
    render(
      <MemoryRouter initialEntries={["/clientes/1"]}>
        <Routes>
          <Route path="/clientes/:clienteId" element={<ClientePerfilPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/Cargando perfil/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "GET",
          url: "/clientes/1/perfil/"
        })
      );
    });

    expect(screen.getByText("Perfil de Cliente Demo")).toBeInTheDocument();
    expect(screen.getByText(/Saldo actual/)).toBeInTheDocument();
    expect(screen.getByText(/Ventas recientes/)).toBeInTheDocument();

    mockRequest.mockResolvedValue(perfilMock);
    await screen.findByRole("button", { name: /Recargar perfil/i });
  });
});
