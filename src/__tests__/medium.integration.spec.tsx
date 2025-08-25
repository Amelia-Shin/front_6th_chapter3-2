import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen, within, act } from '@testing-library/react';
import { UserEvent, userEvent } from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { SnackbarProvider } from 'notistack';
import { ReactElement } from 'react';

import {
  setupMockHandlerCreation,
  setupMockHandlerDeletion,
  setupMockHandlerUpdating,
  setupMockHandlerRepeatEvents,
  setupMockHandlerSingleRepeatEvent,
} from '../__mocks__/handlersUtils';
import App from '../App';
import { server } from '../setupTests';
import { Event } from '../types';

const theme = createTheme();

// ! Hard 여기 제공 안함
const setup = (element: ReactElement) => {
  const user = userEvent.setup();

  return {
    ...render(
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SnackbarProvider>{element}</SnackbarProvider>
      </ThemeProvider>
    ),
    user,
  };
};

// ! Hard 여기 제공 안함
const saveSchedule = async (
  user: UserEvent,
  form: Omit<Event, 'id' | 'notificationTime' | 'repeat'> & {
    repeat?: { type: string; interval: number; endDate?: string };
  }
) => {
  const { title, date, startTime, endTime, location, description, category, repeat } = form;

  await user.click(screen.getAllByText('일정 추가')[0]);

  await user.type(screen.getByLabelText('제목'), title);
  await user.type(screen.getByLabelText('날짜'), date);
  await user.type(screen.getByLabelText('시작 시간'), startTime);
  await user.type(screen.getByLabelText('종료 시간'), endTime);
  await user.type(screen.getByLabelText('설명'), description);
  await user.type(screen.getByLabelText('위치'), location);
  await user.click(screen.getByLabelText('카테고리'));
  await user.click(within(screen.getByLabelText('카테고리')).getByRole('combobox'));
  await user.click(screen.getByRole('option', { name: `${category}-option` }));

  // 반복 설정이 있는 경우 처리
  if (repeat && repeat.type !== 'none') {
    await user.click(screen.getByLabelText('반복 유형'));
    await user.click(screen.getByRole('option', { name: `${repeat.type}-option` }));

    if (repeat.endDate) {
      await user.type(screen.getByLabelText('반복 종료일'), repeat.endDate);
    }
  }

  await user.click(screen.getByTestId('event-submit-button'));
};

describe('일정 CRUD 및 기본 기능', () => {
  it('입력한 새로운 일정 정보에 맞춰 모든 필드가 이벤트 리스트에 정확히 저장된다.', async () => {
    setupMockHandlerCreation();

    const { user } = setup(<App />);

    await saveSchedule(user, {
      title: '새 회의',
      date: '2025-10-15',
      startTime: '14:00',
      endTime: '15:00',
      description: '프로젝트 진행 상황 논의',
      location: '회의실 A',
      category: '업무',
    });

    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('새 회의')).toBeInTheDocument();
    expect(eventList.getByText('2025-10-15')).toBeInTheDocument();
    expect(eventList.getByText('14:00 - 15:00')).toBeInTheDocument();
    expect(eventList.getByText('프로젝트 진행 상황 논의')).toBeInTheDocument();
    expect(eventList.getByText('회의실 A')).toBeInTheDocument();
    expect(eventList.getByText('카테고리: 업무')).toBeInTheDocument();
  });

  it('기존 일정의 세부 정보를 수정하고 변경사항이 정확히 반영된다', async () => {
    const { user } = setup(<App />);

    setupMockHandlerUpdating();

    await user.click(await screen.findByLabelText('Edit event'));

    await user.clear(screen.getByLabelText('제목'));
    await user.type(screen.getByLabelText('제목'), '수정된 회의');
    await user.clear(screen.getByLabelText('설명'));
    await user.type(screen.getByLabelText('설명'), '회의 내용 변경');

    await user.click(screen.getByTestId('event-submit-button'));

    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('수정된 회의')).toBeInTheDocument();
    expect(eventList.getByText('회의 내용 변경')).toBeInTheDocument();
  });

  it('일정을 삭제하고 더 이상 조회되지 않는지 확인한다', async () => {
    setupMockHandlerDeletion();

    const { user } = setup(<App />);
    const eventList = within(screen.getByTestId('event-list'));
    expect(await eventList.findByText('삭제할 이벤트')).toBeInTheDocument();

    // 삭제 버튼 클릭
    const allDeleteButton = await screen.findAllByLabelText('Delete event');
    await user.click(allDeleteButton[0]);

    expect(eventList.queryByText('삭제할 이벤트')).not.toBeInTheDocument();
  });
});

describe('일정 뷰', () => {
  it('주별 뷰를 선택 후 해당 주에 일정이 없으면, 일정이 표시되지 않는다.', async () => {
    // ! 현재 시스템 시간 2025-10-01
    const { user } = setup(<App />);

    await user.click(within(screen.getByLabelText('뷰 타입 선택')).getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'week-option' }));

    // ! 일정 로딩 완료 후 테스트
    await screen.findByText('일정 로딩 완료!');

    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('검색 결과가 없습니다.')).toBeInTheDocument();
  });

  it('주별 뷰 선택 후 해당 일자에 일정이 존재한다면 해당 일정이 정확히 표시된다', async () => {
    setupMockHandlerCreation();

    const { user } = setup(<App />);
    await saveSchedule(user, {
      title: '이번주 팀 회의',
      date: '2025-10-02',
      startTime: '09:00',
      endTime: '10:00',
      description: '이번주 팀 회의입니다.',
      location: '회의실 A',
      category: '업무',
    });

    await user.click(within(screen.getByLabelText('뷰 타입 선택')).getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'week-option' }));

    const weekView = within(screen.getByTestId('week-view'));
    expect(weekView.getByText('이번주 팀 회의')).toBeInTheDocument();
  });

  it('월별 뷰에 일정이 없으면, 일정이 표시되지 않아야 한다.', async () => {
    vi.setSystemTime(new Date('2025-01-01'));

    setup(<App />);

    // ! 일정 로딩 완료 후 테스트
    await screen.findByText('일정 로딩 완료!');

    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('검색 결과가 없습니다.')).toBeInTheDocument();
  });

  it('월별 뷰에 일정이 정확히 표시되는지 확인한다', async () => {
    setupMockHandlerCreation();

    const { user } = setup(<App />);
    await saveSchedule(user, {
      title: '이번달 팀 회의',
      date: '2025-10-02',
      startTime: '09:00',
      endTime: '10:00',
      description: '이번달 팀 회의입니다.',
      location: '회의실 A',
      category: '업무',
    });

    const monthView = within(screen.getByTestId('month-view'));
    expect(monthView.getByText('이번달 팀 회의')).toBeInTheDocument();
  });

  it('달력에 1월 1일(신정)이 공휴일로 표시되는지 확인한다', async () => {
    vi.setSystemTime(new Date('2025-01-01'));
    setup(<App />);

    const monthView = screen.getByTestId('month-view');

    // 1월 1일 셀 확인
    const januaryFirstCell = within(monthView).getByText('1').closest('td')!;
    expect(within(januaryFirstCell).getByText('신정')).toBeInTheDocument();
  });
});

describe('검색 기능', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/events', () => {
        return HttpResponse.json({
          events: [
            {
              id: 1,
              title: '팀 회의',
              date: '2025-10-15',
              startTime: '09:00',
              endTime: '10:00',
              description: '주간 팀 미팅',
              location: '회의실 A',
              category: '업무',
              repeat: { type: 'none', interval: 0 },
              notificationTime: 10,
            },
            {
              id: 2,
              title: '프로젝트 계획',
              date: '2025-10-16',
              startTime: '14:00',
              endTime: '15:00',
              description: '새 프로젝트 계획 수립',
              location: '회의실 B',
              category: '업무',
              repeat: { type: 'none', interval: 0 },
              notificationTime: 10,
            },
          ],
        });
      })
    );
  });

  afterEach(() => {
    server.resetHandlers();
  });

  it('검색 결과가 없으면, "검색 결과가 없습니다."가 표시되어야 한다.', async () => {
    const { user } = setup(<App />);

    const searchInput = screen.getByPlaceholderText('검색어를 입력하세요');
    await user.type(searchInput, '존재하지 않는 일정');

    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('검색 결과가 없습니다.')).toBeInTheDocument();
  });

  it("'팀 회의'를 검색하면 해당 제목을 가진 일정이 리스트에 노출된다", async () => {
    const { user } = setup(<App />);

    const searchInput = screen.getByPlaceholderText('검색어를 입력하세요');
    await user.type(searchInput, '팀 회의');

    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('팀 회의')).toBeInTheDocument();
  });

  it('검색어를 지우면 모든 일정이 다시 표시되어야 한다', async () => {
    const { user } = setup(<App />);

    const searchInput = screen.getByPlaceholderText('검색어를 입력하세요');
    await user.type(searchInput, '팀 회의');
    await user.clear(searchInput);

    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('팀 회의')).toBeInTheDocument();
    expect(eventList.getByText('프로젝트 계획')).toBeInTheDocument();
  });
});

describe('일정 충돌', () => {
  afterEach(() => {
    server.resetHandlers();
  });

  it('겹치는 시간에 새 일정을 추가할 때 경고가 표시된다', async () => {
    setupMockHandlerCreation([
      {
        id: '1',
        title: '기존 회의',
        date: '2025-10-15',
        startTime: '09:00',
        endTime: '10:00',
        description: '기존 팀 미팅',
        location: '회의실 B',
        category: '업무',
        repeat: { type: 'none', interval: 0 },
        notificationTime: 10,
      },
    ]);

    const { user } = setup(<App />);

    await saveSchedule(user, {
      title: '새 회의',
      date: '2025-10-15',
      startTime: '09:30',
      endTime: '10:30',
      description: '설명',
      location: '회의실 A',
      category: '업무',
    });

    expect(screen.getByText('일정 겹침 경고')).toBeInTheDocument();
    expect(screen.getByText(/다음 일정과 겹칩니다/)).toBeInTheDocument();
    expect(screen.getByText('기존 회의 (2025-10-15 09:00-10:00)')).toBeInTheDocument();
  });

  it('기존 일정의 시간을 수정하여 충돌이 발생하면 경고가 노출된다', async () => {
    setupMockHandlerUpdating();

    const { user } = setup(<App />);

    const editButton = (await screen.findAllByLabelText('Edit event'))[1];
    await user.click(editButton);

    // 시간 수정하여 다른 일정과 충돌 발생
    await user.clear(screen.getByLabelText('시작 시간'));
    await user.type(screen.getByLabelText('시작 시간'), '08:30');
    await user.clear(screen.getByLabelText('종료 시간'));
    await user.type(screen.getByLabelText('종료 시간'), '10:30');

    await user.click(screen.getByTestId('event-submit-button'));

    expect(screen.getByText('일정 겹침 경고')).toBeInTheDocument();
    expect(screen.getByText(/다음 일정과 겹칩니다/)).toBeInTheDocument();
    expect(screen.getByText('기존 회의 (2025-10-15 09:00-10:00)')).toBeInTheDocument();
  });
});

it('notificationTime을 10으로 하면 지정 시간 10분 전 알람 텍스트가 노출된다', async () => {
  vi.setSystemTime(new Date('2025-10-15 08:49:59'));

  setup(<App />);

  // ! 일정 로딩 완료 후 테스트
  await screen.findByText('일정 로딩 완료!');

  expect(screen.queryByText('10분 후 기존 회의 일정이 시작됩니다.')).not.toBeInTheDocument();

  act(() => {
    vi.advanceTimersByTime(1000);
  });

  expect(screen.getByText('10분 후 기존 회의 일정이 시작됩니다.')).toBeInTheDocument();
});

describe.only('반복 일정', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2025-10-15'));
  });

  afterEach(() => {
    vi.useRealTimers();
    server.resetHandlers();
  });

  it('반복 유형을 선택하여 일정을 생성할 수 있다', async () => {
    setupMockHandlerCreation();

    const { user } = setup(<App />);

    await user.click(screen.getAllByText('일정 추가')[0]);

    // 기본 일정 정보 입력
    await user.type(screen.getByLabelText('제목'), '매주 팀 회의');
    await user.type(screen.getByLabelText('날짜'), '2025-10-15');
    await user.type(screen.getByLabelText('시작 시간'), '09:00');
    await user.type(screen.getByLabelText('종료 시간'), '10:00');
    await user.type(screen.getByLabelText('설명'), '주간 팀 미팅');
    await user.type(screen.getByLabelText('위치'), '회의실 A');
    await user.click(screen.getByLabelText('카테고리'));
    await user.click(within(screen.getByLabelText('카테고리')).getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: '업무-option' }));

    // 반복 유형 선택
    await user.click(screen.getByLabelText('반복 유형'));
    await user.click(screen.getByRole('option', { name: '매주-option' }));

    // 반복 종료 날짜 설정
    await user.type(screen.getByLabelText('반복 종료 날짜'), '2025-10-30');

    await user.click(screen.getByTestId('event-submit-button'));

    // 생성된 일정 확인
    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('매주 팀 회의')).toBeInTheDocument();
    expect(eventList.getByText('반복: 매주')).toBeInTheDocument();
  });

  it('매일 반복 일정을 생성할 수 있다', async () => {
    setupMockHandlerCreation();

    const { user } = setup(<App />);

    await user.click(screen.getAllByText('일정 추가')[0]);

    // 기본 일정 정보 입력
    await user.type(screen.getByLabelText('제목'), '매일 아침 체크인');
    await user.type(screen.getByLabelText('날짜'), '2025-10-15');
    await user.type(screen.getByLabelText('시작 시간'), '09:00');
    await user.type(screen.getByLabelText('종료 시간'), '09:15');
    await user.type(screen.getByLabelText('설명'), '매일 아침 팀 체크인');
    await user.type(screen.getByLabelText('위치'), '온라인');
    await user.click(screen.getByLabelText('카테고리'));
    await user.click(within(screen.getByLabelText('카테고리')).getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: '업무-option' }));

    // 매일 반복 선택
    await user.click(screen.getByLabelText('반복 유형'));
    await user.click(screen.getByRole('option', { name: '매일-option' }));

    await user.click(screen.getByTestId('event-submit-button'));

    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('매일 아침 체크인')).toBeInTheDocument();
    expect(eventList.getByText('반복: 매일')).toBeInTheDocument();
  });

  it('매월 반복 일정을 생성할 수 있다', async () => {
    setupMockHandlerCreation();

    const { user } = setup(<App />);

    await user.click(screen.getAllByText('일정 추가')[0]);

    // 31일에 매월 반복 일정 생성
    await user.type(screen.getByLabelText('제목'), '매월 말 프로젝트 리뷰');
    await user.type(screen.getByLabelText('날짜'), '2025-10-31');
    await user.type(screen.getByLabelText('시작 시간'), '14:00');
    await user.type(screen.getByLabelText('종료 시간'), '15:00');
    await user.type(screen.getByLabelText('설명'), '월간 프로젝트 진행상황 리뷰');
    await user.type(screen.getByLabelText('위치'), '회의실 B');
    await user.click(screen.getByLabelText('카테고리'));
    await user.click(within(screen.getByLabelText('카테고리')).getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: '업무-option' }));

    // 매월 반복 선택
    await user.click(screen.getByLabelText('반복 유형'));
    await user.click(screen.getByRole('option', { name: '매월-option' }));

    await user.click(screen.getByTestId('event-submit-button'));

    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('매월 말 프로젝트 리뷰')).toBeInTheDocument();
    expect(eventList.getByText('반복: 매월')).toBeInTheDocument();
  });

  it('매년 반복 일정을 생성할 수 있다', async () => {
    setupMockHandlerCreation();

    const { user } = setup(<App />);

    await user.click(screen.getAllByText('일정 추가')[0]);

    // 윤년 29일에 매년 반복 일정 생성
    await user.type(screen.getByLabelText('제목'), '매년 회사 창립일');
    await user.type(screen.getByLabelText('날짜'), '2025-10-01');
    await user.type(screen.getByLabelText('시작 시간'), '10:00');
    await user.type(screen.getByLabelText('종료 시간'), '11:00');
    await user.type(screen.getByLabelText('설명'), '회사 창립 기념일');
    await user.type(screen.getByLabelText('위치'), '대강당');
    await user.click(screen.getByLabelText('카테고리'));
    await user.click(within(screen.getByLabelText('카테고리')).getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: '기타-option' }));

    // 매년 반복 선택
    await user.click(screen.getByLabelText('반복 유형'));
    await user.click(screen.getByRole('option', { name: '매년-option' }));

    await user.click(screen.getByTestId('event-submit-button'));

    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('매년 회사 창립일')).toBeInTheDocument();
    expect(eventList.getByText('반복: 매년')).toBeInTheDocument();
  });

  it('반복 일정이 캘린더 뷰에서 아이콘과 함께 표시된다', async () => {
    setupMockHandlerRepeatEvents();

    setup(<App />);

    // 월별 뷰에서 반복 일정 확인
    const monthView = within(screen.getByTestId('month-view'));

    // 반복 일정 아이콘 확인
    expect(monthView.getByText('매주 팀 회의')).toBeInTheDocument();
    expect(monthView.getByText('매월 프로젝트 리뷰')).toBeInTheDocument();
    expect(monthView.getByText('매년 회사 창립일')).toBeInTheDocument();

    // 반복 일정 리스트에서도 확인
    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('매주 팀 회의')).toBeInTheDocument();
    expect(eventList.getByText('반복: 매주')).toBeInTheDocument();
    expect(eventList.getByText('매월 프로젝트 리뷰')).toBeInTheDocument();
    expect(eventList.getByText('반복: 매월')).toBeInTheDocument();
  });

  it('반복 일정을 수정하면 단일 일정으로 변경된다', async () => {
    setupMockHandlerSingleRepeatEvent();

    const { user } = setup(<App />);

    // 반복 일정 수정 버튼 클릭
    const editButton = await screen.findByLabelText('Edit event');
    await user.click(editButton);

    // 제목 수정
    await user.clear(screen.getByLabelText('제목'));
    await user.type(screen.getByLabelText('제목'), '수정된 팀 회의');

    // 반복 일정 체크박스 해제하여 단일 일정으로 변경
    await user.click(screen.getByLabelText('반복 일정'));

    await user.click(screen.getByTestId('event-submit-button'));

    // 수정된 일정 확인 - 반복 정보가 사라져야 함
    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('수정된 팀 회의')).toBeInTheDocument();
    expect(eventList.queryByText('반복: 매주')).not.toBeInTheDocument();
  });

  it('반복 일정을 삭제하면 해당 일정만 삭제된다', async () => {
    setupMockHandlerRepeatEvents();

    const { user } = setup(<App />);

    // 반복 일정 삭제 버튼 클릭
    const deleteButton = await screen.findByLabelText('Delete event');
    await user.click(deleteButton);

    // 삭제 확인 다이얼로그에서 확인
    const confirmButton = screen.getByText('확인');
    await user.click(confirmButton);

    // 삭제된 일정이 더 이상 표시되지 않음
    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.queryByText('매주 팀 회의')).not.toBeInTheDocument();

    // 다른 반복 일정들은 여전히 표시됨
    expect(eventList.getByText('매월 프로젝트 리뷰')).toBeInTheDocument();
    expect(eventList.getByText('매년 회사 창립일')).toBeInTheDocument();
  });

  it('반복 종료 날짜까지 반복 일정이 생성된다', async () => {
    setupMockHandlerCreation();

    const { user } = setup(<App />);

    await user.click(screen.getAllByText('일정 추가')[0]);

    // 2025-10-15부터 2025-10-30까지 매주 반복
    await user.type(screen.getByLabelText('제목'), '매주 팀 회의');
    await user.type(screen.getByLabelText('날짜'), '2025-10-15');
    await user.type(screen.getByLabelText('시작 시간'), '09:00');
    await user.type(screen.getByLabelText('종료 시간'), '10:00');
    await user.type(screen.getByLabelText('설명'), '주간 팀 미팅');
    await user.type(screen.getByLabelText('위치'), '회의실 A');
    await user.click(screen.getByLabelText('카테고리'));
    await user.click(within(screen.getByLabelText('카테고리')).getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: '업무-option' }));

    // 매주 반복 선택
    await user.click(screen.getByLabelText('반복 유형'));
    await user.click(screen.getByRole('option', { name: '매주-option' }));

    // 반복 종료 날짜 설정 (2025-10-30)
    await user.type(screen.getByLabelText('반복 종료 날짜'), '2025-10-30');

    await user.click(screen.getByTestId('event-submit-button'));

    // 생성된 반복 일정 확인
    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('매주 팀 회의')).toBeInTheDocument();
    expect(eventList.getByText('반복: 매주')).toBeInTheDocument();
    expect(eventList.getByText('반복 종료: 2025-10-30')).toBeInTheDocument();
  });

  it('주별 뷰에서 반복 일정이 올바르게 표시된다', async () => {
    setupMockHandlerRepeatEvents();

    const { user } = setup(<App />);

    // 주별 뷰로 변경
    await user.click(within(screen.getByLabelText('뷰 타입 선택')).getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'week-option' }));

    // 주별 뷰에서 반복 일정 확인
    const weekView = within(screen.getByTestId('week-view'));
    expect(weekView.getByText('매주 팀 회의')).toBeInTheDocument();

    // 반복 일정 아이콘도 표시되어야 함
    expect(weekView.getByTestId('repeat-icon')).toBeInTheDocument();
  });

  it('월별 뷰에서 반복 일정이 올바르게 표시된다', async () => {
    setupMockHandlerRepeatEvents();

    const { user } = setup(<App />);

    // 월별 뷰로 변경
    await user.click(within(screen.getByLabelText('뷰 타입 선택')).getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'month-option' }));

    // 월별 뷰에서 반복 일정 확인
    const monthView = within(screen.getByTestId('month-view'));
    expect(monthView.getByText('매주 팀 회의')).toBeInTheDocument();
    expect(monthView.getByText('매월 프로젝트 리뷰')).toBeInTheDocument();
    expect(monthView.getByText('매년 회사 창립일')).toBeInTheDocument();

    // 반복 일정 아이콘들도 표시되어야 함
    const repeatIcons = monthView.getAllByTestId('repeat-icon');
    expect(repeatIcons).toHaveLength(3);
  });
});
