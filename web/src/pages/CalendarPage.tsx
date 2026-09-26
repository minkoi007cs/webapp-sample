import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Calendar,
  Card,
  DatePicker,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import { Check, Clock, MapPin, Plus, X } from 'lucide-react';
import dayjs, { type Dayjs } from 'dayjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { calendarApi, type CalendarEvent } from '../api/calendar';
import { userApi } from '../api/user';
import { asArray } from '../api/client';

const { Title, Text } = Typography;

type MaintenanceMetadata = {
  maintenanceId?: string;
  assetId?: string;
  maintenanceType?: 'maintenance' | 'operation' | 'liability';
  maintenanceStatus?: 'open' | 'completed' | 'skipped';
};

const maintenanceTypeLabels: Record<string, string> = {
  maintenance: 'Maintenance',
  operation: 'Operation',
  liability: 'Liability',
};

const maintenanceStatusLabels: Record<string, string> = {
  open: 'Pending',
  completed: 'Recorded',
  skipped: 'Skipped',
};

const eventTypeLabels: Record<CalendarEvent['type'], string> = {
  EVENT: 'Event',
  MAINTENANCE: 'Asset',
  PAYMENT: 'Payment',
  REMINDER: 'Reminder',
};

const parseMaintenanceMetadata = (event: CalendarEvent): MaintenanceMetadata | null => {
  if (!event.metadata) return null;

  try {
    return JSON.parse(event.metadata) as MaintenanceMetadata;
  } catch {
    return null;
  }
};

const getEventKindLabel = (event: CalendarEvent) => {
  const metadata = parseMaintenanceMetadata(event);
  if (event.type === 'MAINTENANCE' && metadata?.maintenanceType) {
    return maintenanceTypeLabels[metadata.maintenanceType] || eventTypeLabels[event.type];
  }
  return eventTypeLabels[event.type];
};

const getEventStatusLabel = (event: CalendarEvent) => {
  const metadata = parseMaintenanceMetadata(event);
  if (event.type === 'MAINTENANCE' && metadata?.maintenanceStatus) {
    return maintenanceStatusLabels[metadata.maintenanceStatus] || null;
  }
  return null;
};

const getEventBadgeStatus = (event: CalendarEvent): 'success' | 'processing' | 'default' | 'warning' => {
  const metadata = parseMaintenanceMetadata(event);

  if (event.type === 'MAINTENANCE') {
    if (metadata?.maintenanceStatus === 'completed') return 'success';
    if (metadata?.maintenanceStatus === 'skipped') return 'default';
    return 'warning';
  }

  return 'processing';
};

const EventListCard = ({
  title,
  events,
  emptyText,
  onEdit,
}: {
  title: string;
  events: CalendarEvent[];
  emptyText: string;
  onEdit: (event: CalendarEvent) => void;
}) => (
  <Card
    title={<Title level={4} className="!m-0">{title}</Title>}
    className="border-none shadow-sm rounded-2xl glass-card"
  >
    {events.length ? (
      <div className="flex flex-col gap-3 max-h-[340px] overflow-y-auto pr-1">
        {events.map((event) => {
          const statusLabel = getEventStatusLabel(event);
          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border bg-card p-4 shadow-sm cursor-pointer hover:bg-muted/40 transition-colors"
              onClick={() => onEdit(event)}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <Title level={5} className="!m-0 !text-foreground">{event.title}</Title>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Tag color={event.type === 'MAINTENANCE' ? 'orange' : 'blue'}>
                      {getEventKindLabel(event)}
                    </Tag>
                    {statusLabel ? <Tag color={getEventBadgeStatus(event)}>{statusLabel}</Tag> : null}
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>{dayjs(event.startDate).format('YYYY-MM-DD')}</div>
                  <div>{dayjs(event.startDate).format('HH:mm')}</div>
                </div>
              </div>

              <Text type="secondary" className="block mb-3 line-clamp-2">
                {event.description || 'No description provided'}
              </Text>

              <Space className="w-full text-muted-foreground text-sm" wrap>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{dayjs(event.startDate).format('HH:mm')}</span>
                </div>
                {event.location ? (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    <span className="truncate max-w-[160px]">{event.location}</span>
                  </div>
                ) : null}
              </Space>
            </motion.div>
          );
        })}
      </div>
    ) : (
      <div className="py-10 text-center text-muted-foreground">
        <Text type="secondary">{emptyText}</Text>
      </div>
    )}
  </Card>
);

export const CalendarPage = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: events = [] } = useQuery({
    queryKey: ['calendar-events'],
    queryFn: () => calendarApi.getAll().then((res) => res.data),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => userApi.findAll().then((res) => asArray(res.data)),
  });

  const createMutation = useMutation({
    mutationFn: (values: any) => calendarApi.create(values).then((res) => res.data),
    onSuccess: () => {
      message.success('Event added successfully');
      setIsModalVisible(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: any) => calendarApi.update(selectedEvent!.id, values).then((res) => res.data),
    onSuccess: () => {
      message.success('Event updated successfully');
      setIsModalVisible(false);
      setSelectedEvent(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    },
  });

  const selectedDayEvents = useMemo(
    () => events.filter((event) => dayjs(event.startDate).isSame(selectedDate, 'day')),
    [events, selectedDate],
  );

  const futureEvents = useMemo(
    () => events
      .filter((event) => dayjs(event.startDate).isAfter(dayjs(), 'minute'))
      .sort((a, b) => dayjs(a.startDate).valueOf() - dayjs(b.startDate).valueOf()),
    [events],
  );

  const pastEvents = useMemo(
    () => events
      .filter((event) => dayjs(event.startDate).isBefore(dayjs(), 'minute'))
      .sort((a, b) => dayjs(b.startDate).valueOf() - dayjs(a.startDate).valueOf()),
    [events],
  );

  const dateCellRender = (value: Dayjs) => {
    const listData = events.filter((event) => dayjs(event.startDate).isSame(value, 'day'));
    return (
      <ul className="list-none p-0 m-0 overflow-hidden">
        {listData.slice(0, 3).map((item) => (
          <li key={item.id} className="mt-1">
            <Badge
              status={getEventBadgeStatus(item)}
              text={<span className="text-[12px] truncate max-w-[80px] inline-block">{getEventKindLabel(item)}</span>}
            />
          </li>
        ))}
      </ul>
    );
  };

  const handleSave = (values: any) => {
    const payload = {
      ...values,
      startDate: values.startDate.toISOString(),
      endDate: values.endDate?.toISOString(),
      participantIds: values.participantIds,
    };

    if (selectedEvent) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (event: CalendarEvent) => {
    setSelectedEvent(event);
    form.setFieldsValue({
      ...event,
      startDate: dayjs(event.startDate),
      endDate: event.endDate ? dayjs(event.endDate) : undefined,
      participantIds: event.participants?.map((participant) => participant.id),
    });
    setIsModalVisible(true);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto min-h-screen">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4"
      >
        <div>
          <Title level={2} className="!m-0">Family Calendar</Title>
          <Text type="secondary">Track joint events, upcoming asset milestones, and historical schedules</Text>
        </div>
        <Button
          type="primary"
          icon={<Plus className="w-4 h-4" />}
          size="large"
          onClick={() => {
            setSelectedEvent(null);
            setIsModalVisible(true);
            form.setFieldsValue({ startDate: selectedDate });
          }}
          className="rounded-xl flex items-center justify-center"
          title="Add Event"
          aria-label="Add Event"
        >
          Add Event
        </Button>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <Card className="border-none shadow-sm rounded-2xl overflow-hidden glass-card">
            <Calendar fullscreen cellRender={dateCellRender} onSelect={setSelectedDate} className="p-4" />
          </Card>
        </div>

        <div className="space-y-6">
          <EventListCard
            title={`Events for ${selectedDate.format('YYYY-MM-DD')}`}
            events={selectedDayEvents}
            emptyText="No events on selected date"
            onEdit={handleEdit}
          />
          <EventListCard
            title="Upcoming Events"
            events={futureEvents}
            emptyText="No upcoming events scheduled"
            onEdit={handleEdit}
          />
          <EventListCard
            title="Past Events"
            events={pastEvents}
            emptyText="No past events"
            onEdit={handleEdit}
          />
        </div>
      </div>

      <Modal
        title={selectedEvent ? 'Edit Event' : 'Add New Event'}
        open={isModalVisible}
        forceRender
        onCancel={() => setIsModalVisible(false)}
        footer={[
          <div key="metadata" className="flex flex-col items-start text-[12px] text-muted-foreground mb-4 px-2 sm:px-4 w-full">
            {selectedEvent?.createdAt ? (
              <span>Created by {selectedEvent.creator?.fullName || selectedEvent.creator?.email || 'System'} at {dayjs(selectedEvent.createdAt).format('HH:mm YYYY-MM-DD')}</span>
            ) : null}
            {selectedEvent?.updatedAt && selectedEvent.updatedBy ? (
              <span>Last updated by {selectedEvent.updater?.fullName || selectedEvent.updater?.email || '-'} at {dayjs(selectedEvent.updatedAt).format('HH:mm YYYY-MM-DD')}</span>
            ) : null}
          </div>,
          <Button
            key="cancel"
            type="text"
            icon={<X size={18} />}
            title="Cancel"
            aria-label="Cancel"
            onClick={() => setIsModalVisible(false)}
          />,
          <Button
            key="submit"
            type="primary"
            icon={<Check size={18} />}
            title={selectedEvent ? 'Update' : 'Create'}
            aria-label={selectedEvent ? 'Update' : 'Create'}
            onClick={() => form.submit()}
            loading={createMutation.isPending || updateMutation.isPending}
          />,
        ]}
        width={550}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          className="mt-6"
          initialValues={{ type: 'EVENT', isFullDay: false }}
        >
          <Form.Item
            name="title"
            label="Event Title"
            rules={[{ required: true, message: 'Please enter event title' }]}
          >
            <Input placeholder="e.g., Family Dinner, Birthday..." className="rounded-lg h-10" />
          </Form.Item>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Form.Item name="type" label="Type" rules={[{ required: true }]}>
              <Select className="h-10">
                <Select.Option value="EVENT">Event</Select.Option>
                <Select.Option value="MAINTENANCE">Asset Maintenance</Select.Option>
                <Select.Option value="PAYMENT">Payment</Select.Option>
                <Select.Option value="REMINDER">Reminder</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="reminderMinutes" label="Reminder in Advance">
              <Select className="h-10" placeholder="Select advance notice">
                <Select.Option value={0}>At start time</Select.Option>
                <Select.Option value={5}>5 minutes before</Select.Option>
                <Select.Option value={15}>15 minutes before</Select.Option>
                <Select.Option value={30}>30 minutes before</Select.Option>
                <Select.Option value={60}>1 hour before</Select.Option>
                <Select.Option value={120}>2 hours before</Select.Option>
                <Select.Option value={1440}>1 day before</Select.Option>
              </Select>
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Form.Item name="recurrenceRule" label="Recurrence">
              <Select className="h-10" placeholder="Recurrence pattern">
                <Select.Option value={undefined}>No recurrence</Select.Option>
                <Select.Option value="DAILY">Daily</Select.Option>
                <Select.Option value="WEEKLY">Weekly</Select.Option>
                <Select.Option value="MONTHLY">Monthly</Select.Option>
                <Select.Option value="YEARLY">Yearly</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="participantIds" label="Assigned Participants">
              <Select
                mode="multiple"
                className="w-full"
                placeholder="Select participants"
                options={users.map((user) => ({ value: user.id, label: user.fullName || user.email }))}
                allowClear
              />
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Form.Item name="startDate" label="Start Time" rules={[{ required: true }]}>
              <DatePicker showTime className="w-full h-10 rounded-lg" />
            </Form.Item>
            <Form.Item name="endDate" label="End Time">
              <DatePicker showTime className="w-full h-10 rounded-lg" />
            </Form.Item>
          </div>

          <Form.Item name="location" label="Location">
            <Input prefix={<MapPin className="w-4 h-4 text-muted-foreground" />} placeholder="Enter location..." className="rounded-lg h-10" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea placeholder="Additional notes..." rows={3} className="rounded-lg" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
