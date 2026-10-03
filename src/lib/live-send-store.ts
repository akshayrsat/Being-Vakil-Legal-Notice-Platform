// Reads and saves the live-send switch. The row is the running site's choice.
// It overrides MSG91_LIVE_SEND and is still there after a restart.

import { prisma } from "./db";
import { effectiveLiveSend, LIVE_SEND_SETTING_ID } from "./live-send-switch";

type LiveSendDb = {
  liveSendSetting: {
    findUnique: (args: {
      where: { id: string };
    }) => Promise<{ enabled: boolean } | null>;
    upsert: (args: {
      where: { id: string };
      create: { id: string; enabled: boolean };
      update: { enabled: boolean };
    }) => Promise<unknown>;
  };
};

export async function readLiveSendEnabled(db: LiveSendDb = prisma): Promise<boolean> {
  const row = await db.liveSendSetting.findUnique({ where: { id: LIVE_SEND_SETTING_ID } });
  return effectiveLiveSend(row?.enabled ?? null);
}

export async function liveSendIsOn(): Promise<boolean> {
  return readLiveSendEnabled(prisma);
}

export async function saveLiveSendSwitch(enabled: boolean, db: LiveSendDb = prisma): Promise<void> {
  await db.liveSendSetting.upsert({
    where: { id: LIVE_SEND_SETTING_ID },
    create: { id: LIVE_SEND_SETTING_ID, enabled },
    update: { enabled },
  });
}
