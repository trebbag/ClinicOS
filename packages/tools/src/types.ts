export type ToolDescriptor = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type ToolHandler<Input = unknown, Output = unknown> = (input: Input) => Promise<Output>;

export type BusinessToolContext<Service = unknown, Actor = unknown> = {
  service?: Service;
  actor?: Actor;
};
