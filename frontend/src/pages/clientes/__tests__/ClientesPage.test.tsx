import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ClientesPage from "@/pages/clientes/ClientesPage";
import type { Cliente } from "@/types/mipyme";

const mockRecargar = vi.fn();
const mockRequest = vi.fn();

window.scrollTo = vi.fn();

vi.mock("@/hooks/useListado", () => ({
  useListado: () => ({
    datos: [
      {
        id: 1,
        nombre: "Cliente Demo",
        identificacion: "20123456789",
        correo: "demo@mipyme.com",
        telefono: "1112345678",
        direccion: "Av. Siempre Viva",
        saldo: "1500.00"
      } satisfies Cliente
    ],
    cargando: false,
    error: null,
    recargar: mockRecargar
  })
}));

vi.mock("@/hooks/useApi", () => ({
  useApi: () => ({
    request: mockRequest
  })
}));

describe("ClientesPage", () => {
  beforeEach(() => {
    mockRecargar.mockClear();
    mockRecargar.mockResolvedValue(undefined);
    mockRequest.mockReset();
  });

  const renderWithRouter = () =>
    render(
      <MemoryRouter>
        <ClientesPage />
      </MemoryRouter>
    );

  it("permite crear un nuevo cliente y refrescar el listado", async () => {
    mockRequest.mockResolvedValue({} as Cliente);

    renderWithRouter();

    const user = userEvent.setup();

    const inputNombre = screen.getByLabelText(/Nombre completo/i) as HTMLInputElement;
    const inputIdentificacion = screen.getByLabelText(/Identificacion/i) as HTMLInputElement;
    const inputCorreo = screen.getByLabelText(/Correo electronico/i) as HTMLInputElement;

    await user.clear(inputNombre);
    await user.clear(inputIdentificacion);
    await user.clear(inputCorreo);

    await user.type(inputNombre, "Ana Perez");
    await user.type(inputIdentificacion, "20999888777");
    await user.type(inputCorreo, "ana@acme.com");

    await user.click(screen.getByRole("button", { name: /Guardar cliente/i }));

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          url: "/clientes/"
        })
      );
    });

    const payload = mockRequest.mock.calls[0][0];
    expect(payload.data).toMatchObject({ nombre: "Ana Perez", identificacion: "20999888777" });

    await waitFor(() => {
      expect(mockRecargar).toHaveBeenCalled();
    });

    expect(await screen.findByText("Cliente creado correctamente")).toBeInTheDocument();
  });

  it("muestra el saldo y permite editar y borrar", async () => {
    mockRequest.mockResolvedValue({} as Cliente);

    renderWithRouter();

    expect(screen.getByText((content) => content.includes("$"))).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("link", { name: /Ver perfil/i }));
    // navega pero MemoryRouter sin rutas secundarias; solo verificamos que Link existe

    await user.click(screen.getByRole("button", { name: /Modificar/i }));

    expect(screen.getByLabelText(/Identificacion/i)).toHaveValue("20123456789");

    await user.click(screen.getByRole("button", { name: /Guardar cambios/i }));

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "PUT",
          url: "/clientes/1/"
        })
      );
    });

    mockRequest.mockResolvedValue(undefined);
    window.confirm = vi.fn().mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: /Borrar/i }));

    await waitFor(() => {
      expect(mockRequest).toHaveBeenLastCalledWith(
        expect.objectContaining({
          method: "DELETE",
          url: "/clientes/1/"
        })
      );
    });
  });
});
