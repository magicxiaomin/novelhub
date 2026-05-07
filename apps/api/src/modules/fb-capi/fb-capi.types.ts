export type FbUserData = {
  email?: string;
  fbp?: string;
  fbc?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
};

export type FbCustomData = {
  currency?: string;
  value?: number;
  contentIds?: string[];
  contentType?: string;
};

export type FbEventPayload = {
  data: Array<{
    event_name: string;
    event_time: number;
    event_id: string;
    action_source: 'website';
    user_data: {
      em?: string[];
      fbp?: string;
      fbc?: string;
      client_ip_address?: string;
      client_user_agent?: string;
    };
    custom_data?: {
      currency?: string;
      value?: number;
      content_ids?: string[];
      content_type?: string;
    };
  }>;
  test_event_code?: string;
  access_token?: string;
};
