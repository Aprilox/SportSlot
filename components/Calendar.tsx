'use client';

import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useTranslation } from 'react-i18next';

type Slot = {
  id: number;
  sport: string;
  dateTime: string;
  duration: number;
  maxCapacity: number;
  currentBookings: number;
  price: number;
};

type CalendarProps = {
  slots: Slot[];
  onSelectSlot: (slotId: number) => void;
};

export default function Calendar({ slots, onSelectSlot }: CalendarProps) {
  const { t } = useTranslation();

  const events = slots.map((slot) => ({
    id: slot.id.toString(),
    title: `${slot.sport} - ${slot.price} CHF`,
    start: slot.dateTime,
    end: new Date(new Date(slot.dateTime).getTime() + slot.duration * 60000),
    extendedProps: { slotId: slot.id },
  }));

  return (
    <FullCalendar
      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
      initialView="timeGridWeek"
      events={events}
      eventClick={(info) => onSelectSlot(parseInt(info.event.extendedProps.slotId))}
      headerToolbar={{
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay',
      }}
      slotMinTime="08:00:00"
      slotMaxTime="22:00:00"
      allDaySlot={false}
      locale={t('calendar.locale')}
    />
  );
}
