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
  maintenance: 'Bảo trì',
  operation: 'Khai thác',
  liability: 'Nợ',
};

const maintenanceStatusLabels: Record<string, string> = {
  open: 'Đang chờ',
  completed: 'Đã ghi nhận',
  skipped: 'Đã bỏ qua',
};

const eventTypeLabels: Record<CalendarEvent['type'], string> = {
  EVENT: 'Sự kiện',
  MAINTENANCE: 'Tài sản',
  PAYMENT: 'Thanh toán',
  REMINDER: 'Nhắc việc',
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
    className="border-none shadow-xl shadow-slate-200/50 rounded-2xl glass-card"
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
              className="rounded-xl border border-slate-100 bg-white/80 p-4 shadow-sm cursor-pointer hover:bg-white transition-colors"
              onClick={() => onEdit(event)}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <Title level={5} className="!m-0 !text-slate-800">{event.title}</Title>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Tag color={event.type === 'MAINTENANCE' ? 'orange' : 'blue'}>
                      {getEventKindLabel(event)}
                    </Tag>
                    {statusLabel ? <Tag color={getEventBadgeStatus(event)}>{statusLabel}</Tag> : null}
                  </div>
                </div>
                <div className="text-right text-xs text-slate-700">
                  <div>{dayjs(event.startDate).format('DD/MM/YYYY')}</div>
                  <div>{dayjs(event.startDate).format('HH:mm')}</div>
                </div>
              </div>

              <Text type="secondary" className="block mb-3 line-clamp-2">
                {event.description || 'Không có mô tả'}
              </Text>

              <Space className="w-full text-slate-700 text-sm" wrap>
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
      <div className="py-10 text-center text-slate-600">
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
      message.success('Thêm sự kiện thành công');
      setIsModalVisible(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: any) => calendarApi.update(selectedEvent!.id, values).then((res) => res.data),
    onSuccess: () => {
      message.success('Cập nhật sự kiện thành công');
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
    <div className="p-4 md:p-8 max-w-7xl mx-auto min-h-screen bg-slate-50/50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4"
      >
        <div>
          <Title level={2} className="!m-0">Lịch gia đình</Title>
          <Text type="secondary">Theo dõi sự kiện chung, lịch tài sản sắp tới và lịch sử đã diễn ra</Text>
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
          className="bg-sky-500 hover:bg-sky-600 border-none shadow-lg shadow-sky-200/50 h-12 w-12 rounded-xl flex items-center justify-center p-0"
          title="Thêm sự kiện"
          aria-label="Thêm sự kiện"
        />
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <Card className="border-none shadow-xl shadow-slate-200/50 rounded-2xl overflow-hidden glass-card">
            <Calendar fullscreen cellRender={dateCellRender} onSelect={setSelectedDate} className="p-4" />
          </Card>
        </div>

        <div className="space-y-6">
          <EventListCard
            title={`Sự kiện ngày ${selectedDate.format('DD/MM/YYYY')}`}
            events={selectedDayEvents}
            emptyText="Không có sự kiện trong ngày đang chọn"
            onEdit={handleEdit}
          />
          <EventListCard
            title="Sự kiện sắp tới"
            events={futureEvents}
            emptyText="Chưa có sự kiện tương lai"
            onEdit={handleEdit}
          />
          <EventListCard
            title="Sự kiện đã qua"
            events={pastEvents}
            emptyText="Chưa có sự kiện đã qua"
            onEdit={handleEdit}
          />
        </div>
      </div>

      <Modal
        title={selectedEvent ? 'Sửa sự kiện' : 'Thêm sự kiện mới'}
        open={isModalVisible}
        forceRender
        onCancel={() => setIsModalVisible(false)}
        footer={[
          <div key="metadata" className="flex flex-col items-start text-[12px] text-slate-600 mb-4 px-2 sm:px-4 w-full">
            {selectedEvent?.createdAt ? (
              <span>Tạo bởi {selectedEvent.creator?.fullName || selectedEvent.creator?.email || 'Hệ thống'} lúc {dayjs(selectedEvent.createdAt).format('HH:mm DD/MM/YYYY')}</span>
            ) : null}
            {selectedEvent?.updatedAt && selectedEvent.updatedBy ? (
              <span>Cập nhật cuối bởi {selectedEvent.updater?.fullName || selectedEvent.updater?.email || '-'} lúc {dayjs(selectedEvent.updatedAt).format('HH:mm DD/MM/YYYY')}</span>
            ) : null}
          </div>,
          <Button
            key="cancel"
            type="text"
            icon={<X size={18} />}
            title="Hủy"
            aria-label="Hủy"
            onClick={() => setIsModalVisible(false)}
          />,
          <Button
            key="submit"
            type="primary"
            icon={<Check size={18} />}
            title={selectedEvent ? 'Cập nhật' : 'Tạo mới'}
            aria-label={selectedEvent ? 'Cập nhật' : 'Tạo mới'}
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
            label="Tiêu đề"
            rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}
          >
            <Input placeholder="Ví dụ: Họp gia đình, Sinh nhật..." className="rounded-lg h-10" />
          </Form.Item>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Form.Item name="type" label="Loại" rules={[{ required: true }]}>
              <Select className="h-10">
                <Select.Option value="EVENT">Sự kiện</Select.Option>
                <Select.Option value="MAINTENANCE">Tài sản</Select.Option>
                <Select.Option value="PAYMENT">Thanh toán</Select.Option>
                <Select.Option value="REMINDER">Ghi chú</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="reminderMinutes" label="Báo trước">
              <Select className="h-10" placeholder="Chọn thời gian nhắc">
                <Select.Option value={0}>Khi bắt đầu</Select.Option>
                <Select.Option value={5}>5 phút trước</Select.Option>
                <Select.Option value={15}>15 phút trước</Select.Option>
                <Select.Option value={30}>30 phút trước</Select.Option>
                <Select.Option value={60}>1 tiếng trước</Select.Option>
                <Select.Option value={120}>2 tiếng trước</Select.Option>
                <Select.Option value={1440}>1 ngày trước</Select.Option>
              </Select>
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Form.Item name="recurrenceRule" label="Lặp lại">
              <Select className="h-10" placeholder="Chế độ lặp">
                <Select.Option value={undefined}>Không lặp</Select.Option>
                <Select.Option value="DAILY">Hàng ngày</Select.Option>
                <Select.Option value="WEEKLY">Hàng tuần</Select.Option>
                <Select.Option value="MONTHLY">Hàng tháng</Select.Option>
                <Select.Option value="YEARLY">Hàng năm</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="participantIds" label="Người tham gia / Nhắc cho ai">
              <Select
                mode="multiple"
                className="w-full"
                placeholder="Chọn người nhắc"
                options={users.map((user) => ({ value: user.id, label: user.fullName || user.email }))}
                allowClear
              />
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Form.Item name="startDate" label="Bắt đầu" rules={[{ required: true }]}>
              <DatePicker showTime className="w-full h-10 rounded-lg" />
            </Form.Item>
            <Form.Item name="endDate" label="Kết thúc">
              <DatePicker showTime className="w-full h-10 rounded-lg" />
            </Form.Item>
          </div>

          <Form.Item name="location" label="Địa điểm">
            <Input prefix={<MapPin className="w-4 h-4 text-slate-600" />} placeholder="Nhập địa điểm..." className="rounded-lg h-10" />
          </Form.Item>

          <Form.Item name="description" label="Mô tả">
            <Input.TextArea placeholder="Ghi chú thêm..." rows={3} className="rounded-lg" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
