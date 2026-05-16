import { PrismaClient, ScheduleItemType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { DateTime } from 'luxon';

const prisma = new PrismaClient();

type SeedUser = {
  account: string;
  password: string;
  displayName: string;
  timezone: string;
};

const seedUsers: SeedUser[] = [
  {
    account: 'testuser1',
    password: 'TestPassword123!',
    displayName: 'Test User 1',
    timezone: 'Asia/Shanghai',
  },
  {
    account: 'testuser2',
    password: 'TestPassword123!',
    displayName: 'Test User 2',
    timezone: 'Asia/Shanghai',
  },
  {
    account: 'demo',
    password: 'DemoPassword123!',
    displayName: 'Demo User',
    timezone: 'Asia/Shanghai',
  },
];

async function main() {
  await prisma.user.deleteMany({
    where: { account: { in: seedUsers.map((user) => user.account) } },
  });

  for (const seedUser of seedUsers) {
    const passwordHash = await bcrypt.hash(seedUser.password, 12);
    const user = await prisma.user.create({
      data: {
        account: seedUser.account,
        passwordHash,
        displayName: seedUser.displayName,
        locale: 'en',
        timezone: seedUser.timezone,
      },
    });

    const defaultCalendar = await prisma.calendar.create({
      data: {
        userId: user.id,
        name: 'Default',
        color: '#2F80ED',
        isDefault: true,
      },
    });

    const now = DateTime.now().setZone(seedUser.timezone);
    const reminderTime = now.plus({ days: 1 }).set({ hour: 20, minute: 0, second: 0, millisecond: 0 });
    const eventStart = now.plus({ days: 2 }).set({ hour: 19, minute: 0, second: 0, millisecond: 0 });

    await prisma.scheduleItem.createMany({
      data: [
        {
          userId: user.id,
          calendarId: defaultCalendar.id,
          type: ScheduleItemType.REMINDER,
          title: 'Submit homework',
          reminderTime: reminderTime.toJSDate(),
          timezone: seedUser.timezone,
          sourceText: 'remind me to submit homework tomorrow at 8pm',
          aiConfidence: 0.91,
        },
        {
          userId: user.id,
          calendarId: defaultCalendar.id,
          type: ScheduleItemType.EVENT,
          title: 'Dinner with Alex',
          startTime: eventStart.toJSDate(),
          endTime: eventStart.plus({ hours: 2 }).toJSDate(),
          timezone: seedUser.timezone,
          sourceText: 'dinner with Alex next Friday',
          aiConfidence: 0.84,
        },
        {
          userId: user.id,
          calendarId: defaultCalendar.id,
          type: ScheduleItemType.REMINDER,
          title: 'Pay rent',
          reminderTime: now.plus({ months: 1 }).startOf('month').set({ hour: 9 }).toJSDate(),
          timezone: seedUser.timezone,
          recurrenceRule: 'FREQ=MONTHLY;BYMONTHDAY=1',
          sourceText: 'pay rent every month on the 1st',
          aiConfidence: 0.86,
        },
      ],
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
