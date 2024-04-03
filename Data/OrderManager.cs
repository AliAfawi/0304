using BookShop.Models;
using BookStore.Data;
using Microsoft.EntityFrameworkCore;
using System.Collections.Concurrent;
using System.Threading.Tasks;

namespace BookShop.Data
{
    public static class OrderManager
    {
        private static readonly ConcurrentDictionary<string, Order> Orders = new ConcurrentDictionary<string, Order>();
        private static readonly BookStoreContext _context = new BookStoreContext();

        public static async Task<Order> CreateOrderAsync(string userId, TheCart cart)
        {
            var order = new Order
            {
                OrderDate = DateTime.Now,
                User = await _context.Users.FirstOrDefaultAsync(u => u.Id.ToString() == userId),
                TotalPrice = 0, 
                OrderBooks = new List<OrderBooks>()
            };

            foreach (var item in cart.CartItems)
            {
                var book = await _context.Books.FirstOrDefaultAsync(b => b.BookID == item.BookID);
                if (book != null)
                {
                    var orderBook = new OrderBooks
                    {
                        BookID = item.BookID,
                        Quantity = item.Quantity,
                        UnitPrice = (float)book.Price
                    };
                    order.TotalPrice += (float)book.Price * item.Quantity;
                    order.OrderBooks.Add(orderBook);
                }
            }

            await _context.Orders.AddAsync(order);
            await _context.SaveChangesAsync();

            Orders.TryAdd(order.OrderID.ToString(), order);

            return order;
        }

        public static Order GetOrderById(string orderId)
        {
            Orders.TryGetValue(orderId, out var order);
            return order;
        }
    }
}
