// Filters for the status list. The form uses a normal address so the CSV link can share it.

import { DELIVERY_STATUS_OPTIONS, sendChannelLabel } from "@/lib/campaigns";
import { SEND_CHANNELS } from "@/lib/campaign-plan";
import type { DeliveryFilters } from "@/lib/delivery-report";
import { Button } from "@/components/ui/button";

export function DeliveryFiltersForm({
  action,
  filters,
  bankId,
  campaigns,
}: {
  action: string;
  filters: DeliveryFilters;
  bankId: string;
  campaigns: Array<{ id: string; name: string }>;
}) {
  return (
    <form action={action} method="get" className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="bank" value={bankId} />
      <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
        Name, mobile, loan number, or customer id
        <input
          name="q"
          defaultValue={filters.text}
          placeholder="Example: LN10021"
          className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Campaign
        <select
          name="campaign"
          defaultValue={filters.campaignId}
          className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal"
        >
          <option value="">All campaigns</option>
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Channel
        <select
          name="channel"
          defaultValue={filters.channel}
          className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal"
        >
          <option value="">All channels</option>
          {SEND_CHANNELS.map((channel) => (
            <option key={channel} value={channel}>
              {sendChannelLabel(channel)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Status
        <select
          name="status"
          defaultValue={filters.status === "SENT" ? "DELIVERED" : filters.status}
          className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal"
        >
          <option value="">All statuses</option>
          {DELIVERY_STATUS_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        From
        <input
          type="date"
          name="from"
          defaultValue={filters.from}
          className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        To
        <input
          type="date"
          name="to"
          defaultValue={filters.to}
          className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal"
        />
      </label>
      <div className="sm:col-span-2">
        <Button type="submit" className="h-11 px-4">
          Search
        </Button>
      </div>
    </form>
  );
}
