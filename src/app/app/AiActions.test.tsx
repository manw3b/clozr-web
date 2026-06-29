import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AiActions } from "@/app/app/AiActions";
import type { AssistantAction } from "@/lib/api";

describe("AiActions", () => {
  it("no renderiza nada cuando no hay acciones", () => {
    const { container } = render(<AiActions actions={[]} onRun={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("dibuja las acciones de Nivel 2 y las sube por onRun al hacer click", () => {
    const onRun = vi.fn();
    const actions: AssistantAction[] = [
      { type: "navigate", view: "sales", label: "Ver ventas" },
      { type: "open_form", form: "sale", label: "Cargar venta" },
      { type: "whatsapp", label: "Mandar WhatsApp", text: "Hola" },
    ];
    render(<AiActions actions={actions} onRun={onRun} />);

    fireEvent.click(screen.getByText("Ver ventas"));
    fireEvent.click(screen.getByText("Cargar venta"));
    fireEvent.click(screen.getByText("Mandar WhatsApp"));

    expect(onRun).toHaveBeenCalledTimes(3);
    expect(onRun).toHaveBeenNthCalledWith(1, actions[0]);
    expect(onRun).toHaveBeenNthCalledWith(2, actions[1]);
    expect(onRun).toHaveBeenNthCalledWith(3, actions[2]);
  });

  it("confirm_execute muestra el resumen y, al confirmar OK, muestra Hecho", async () => {
    const onRun = vi.fn().mockResolvedValue({ ok: true });
    const action: AssistantAction = {
      type: "confirm_execute",
      tool: "crear_venta",
      label: "Crear venta",
      summary: "Venta a Juan por US$ 100",
      payload: { total: 100 },
    };
    render(<AiActions actions={[action]} onRun={onRun} />);

    expect(screen.getByText("Venta a Juan por US$ 100")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Confirmar"));

    expect(onRun).toHaveBeenCalledWith(action);
    await waitFor(() => expect(screen.getByText("Hecho")).toBeInTheDocument());
  });

  it("confirm_execute con resultado no-ok deja reintentar (degradado elegante)", async () => {
    const onRun = vi.fn().mockResolvedValue({ ok: false });
    const action: AssistantAction = {
      type: "confirm_execute",
      tool: "x",
      label: "Hacer X",
      summary: "Resumen X",
      payload: {},
    };
    render(<AiActions actions={[action]} onRun={onRun} />);

    fireEvent.click(screen.getByText("Confirmar"));
    await waitFor(() => expect(screen.getByText("Reintentar")).toBeInTheDocument());
    expect(screen.queryByText("Hecho")).not.toBeInTheDocument();
  });
});
