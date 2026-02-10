export type AriConfig = {
  baseUrl: string;
  username: string;
  password: string;
  app: string;
  rtpHost: string;
  rtpPort: number;
  codec: "ulaw" | "alaw";
  trunk?: string;
};

export type AriChannel = {
  id: string;
  name?: string;
  state?: string;
  dialplan?: {
    app_name?: string;
    app_data?: string;
  };
  caller?: {
    number?: string;
    name?: string;
  };
};

export type AriBridge = {
  id: string;
  channels?: string[];
};

export type AriEndpointState = {
  technology: string;
  resource: string;
  state: string;
};
