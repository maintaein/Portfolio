import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';

function stubClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'clipboard');
});

describe('useCopyToClipboard', () => {
  it('성공하면 state가 copied가 되고 copy가 true를 반환한다', async () => {
    stubClipboard(vi.fn().mockResolvedValue(undefined));
    const { result } = renderHook(() => useCopyToClipboard());

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.copy('a@b.com', 'k1');
    });

    expect(returned).toBe(true);
    expect(result.current.state).toEqual({ key: 'k1', status: 'copied' });
  });

  it('실패하면 state가 failed가 되고 copy가 false를 반환한다', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    const { result } = renderHook(() => useCopyToClipboard());

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.copy('a@b.com', 'k1');
    });

    expect(returned).toBe(false);
    expect(result.current.state).toEqual({ key: 'k1', status: 'failed' });
  });

  it('resetDelay 뒤 state가 null이 된다', async () => {
    vi.useFakeTimers();
    stubClipboard(vi.fn().mockResolvedValue(undefined));
    const { result } = renderHook(() => useCopyToClipboard(2000));

    await act(async () => {
      await result.current.copy('a@b.com', 'k1');
    });
    expect(result.current.state).not.toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.state).toBeNull();
  });

  it('key가 다른 두 번의 호출에서 나중 것이 이긴다(앞 타이머가 뒤 상태를 조기에 지우지 않는다)', async () => {
    vi.useFakeTimers();
    stubClipboard(vi.fn().mockResolvedValue(undefined));
    const { result } = renderHook(() => useCopyToClipboard(2000));

    await act(async () => {
      await result.current.copy('first@b.com', 'first');
    });
    // 앞 호출이 자기 타이머를 절반만 흘려보낸 채로 있다.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    await act(async () => {
      await result.current.copy('second@b.com', 'second');
    });

    // 앞 타이머가 살아 있었다면 1000ms 뒤(첫 호출 기준 2000ms 지점) state가
    // 조기에 null로 지워졌을 것이다. 새 호출이 그 타이머를 먼저 지웠으므로
    // 뒤 상태가 살아 있어야 한다.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.state).toEqual({ key: 'second', status: 'copied' });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.state).toBeNull();
  });

  it('앞 호출이 pending인 동안 들어온 두 번째 호출의 반환값이 false로 오염되지 않는다', async () => {
    // 재진입 가드가 있었다면 첫 writeText가 resolve되기 전에 들어온 두 번째
    // copy 호출이 즉시 false를 돌려받았을 것이다. 그 false를 Footer가 복사
    // 실패로 읽어 select-all로 영구 전환하는 게 실제 버그였다. 가드를
    // 없앴으므로 두 번째 호출도 자기 writeText를 그대로 부르고 성공을
    // 성공대로 반환해야 한다.
    let resolveFirst: (() => void) | undefined;
    const firstPending = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    const writeText = vi
      .fn()
      .mockImplementationOnce(() => firstPending)
      .mockResolvedValueOnce(undefined);
    stubClipboard(writeText);
    const { result } = renderHook(() => useCopyToClipboard());

    let firstReturned: boolean | undefined;
    let secondReturned: boolean | undefined;

    await act(async () => {
      const firstCall = result.current.copy('a@b.com', 'first').then((v) => {
        firstReturned = v;
      });
      // 첫 호출의 writeText가 아직 pending인 상태에서 두 번째 호출을 건다.
      const secondCall = result.current.copy('b@c.com', 'second').then((v) => {
        secondReturned = v;
      });
      resolveFirst?.();
      await Promise.all([firstCall, secondCall]);
    });

    expect(firstReturned).toBe(true);
    expect(secondReturned).toBe(true);
  });

  it('언마운트 시 리셋 타이머가 clearTimeout으로 정리된다', async () => {
    // React 19부터 언마운트 후 setState는 조용히 no-op이라 콘솔 경고가
    // 뜨지 않는다(경고 자체가 관찰 채널로 죽었다). 그래서 "경고가 안
    // 뜬다"는 정리 여부와 무관하게 항상 통과해 뮤테이션을 못 잡는다.
    // clearTimeout 호출 여부를 직접 봐야 정리 로직이 실제로 지워지면
    // FAIL한다.
    vi.useFakeTimers();
    stubClipboard(vi.fn().mockResolvedValue(undefined));
    const { result, unmount } = renderHook(() => useCopyToClipboard(2000));

    await act(async () => {
      await result.current.copy('a@b.com', 'k1');
    });

    const clearSpy = vi.spyOn(global, 'clearTimeout');
    unmount();

    expect(clearSpy).toHaveBeenCalled();
  });
});
