import { expect } from 'chai';

export function withoutResolve<T extends Promise<unknown>>(p: T): T {
  return p;
}

// revert를 테스트하기 위해서는 resolve 되지 않은 Promise를 인자로 넘겨주어야한다.
// Promise를 의도적으로 resolve하지 않았다는 것을 표시하기 위해 withoutResolve로 Promise를 감싸는 것을 추천한다.
export async function expectRevertedAsync<T extends Promise<unknown>>(p: T, reason: string) {
  await expect(p).to.be.revertedWith(reason);
}
