import axios, { AxiosInstance } from "axios";
import type { EnrichmentRequest, EnrichedProfile, ProfileListResponse, StatsResponse } from "./types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

const client: AxiosInstance = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

export async function submitEnrichment(data: EnrichmentRequest): Promise<{ request_id: string }> {
  const response = await client.post("/enrich", data);
  return response.data;
}

export async function getProfile(requestId: string): Promise<EnrichedProfile> {
  const response = await client.get(`/profile/${requestId}`);
  return response.data;
}

export async function listProfiles(params: {
  page?: number;
  limit?: number;
  date_from?: string;
  date_to?: string;
}): Promise<ProfileListResponse> {
  const response = await client.get("/profiles", {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      ...(params.date_from && { date_from: params.date_from }),
      ...(params.date_to && { date_to: params.date_to }),
    },
  });
  return response.data;
}

export async function getStats(): Promise<StatsResponse> {
  const response = await client.get("/stats");
  return response.data;
}
