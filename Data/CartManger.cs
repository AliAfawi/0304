using BookShop.Migrations;
using BookShop.Models;
using BookStore.Data;
using Microsoft.EntityFrameworkCore;
using System.Collections.Concurrent;

namespace BookShop.Data
{
    public static  class CartManger
    {
        private static readonly ConcurrentDictionary<string, Models.TheCart> Carts = new ConcurrentDictionary<string, Models.TheCart>();
        private static readonly BookStoreContext _context = new BookStoreContext();
        //private static readonly BookStoreContext context;

    
        public static Models.TheCart GetCart(HttpContext httpContext)
        {
            string cartId = GetCartId(httpContext);
            var cart = Carts.GetOrAdd(cartId, _ => new Models.TheCart());

            if (string.IsNullOrEmpty(httpContext.User.Identity.Name))
            {
                cart.SessionId = cartId; // Set SessionId for guest carts
            }
            else
            {
                cart.UserID = httpContext.User.Identity.Name; // Set CustomerId for authenticated users
            }

            return cart;
        }


        //public static void updateStock(Models.TheCart cart, int bookid)
        //{
        //    var cartitem = cart.CartItems.FirstOrDefault(c => c.BookID == bookid);
        //    if (cartitem != null)
        //    {

        //    }

        //}

        private static string GetCartId(HttpContext httpContext)
        {
            // Check if we already have a cart ID in the session
            if (httpContext.Session.GetString("CartId") == null)
            {
                if (!string.IsNullOrEmpty(httpContext.User.Identity.Name))
                {
                    // Authenticated user, use their username or user ID
                    httpContext.Session.SetString("CartId", httpContext.User.Identity.Name);
                }
                else
                {
                    // Guest user, generate a new unique ID
                    httpContext.Session.SetString("CartId", Guid.NewGuid().ToString());
                }
            }

            return httpContext.Session.GetString("CartId");
        }

        public static Models.TheCart GetCartByUserId(string userId)
        {
            // Check if a cart for the user ID already exists
            Models.TheCart cart;
            if (!Carts.TryGetValue(userId, out cart))
            {
                // If not, create a new cart and add it to the dictionary
                cart = new Models.TheCart { UserID = userId };
                Carts.TryAdd(userId, cart);
            }
            return cart;
        }

        public static Models.TheCart GetCartBySessionId(string sessionId)
        {
            // Check if a cart for the session ID already exists
            Models.TheCart cart;
            if (!Carts.TryGetValue(sessionId, out cart))
            {
                // If not, create a new cart and add it to the dictionary
                cart = new Models.TheCart { SessionId = sessionId };
                Carts.TryAdd(sessionId, cart);
            }
            return cart;
        }

        public static Models.TheCart GetCart(string customerId)
        {
            return Carts.GetOrAdd(customerId, new Models.TheCart());
        }


        //public static async int CheckBooKQty(int BooKId)
        //{
        //    var Book = _context.Books.FirstOrDefault(b => b.BookID == BooKId);
        //    if (Book != null)
        //        return Book.StockQuantity;
        //    return 0;
        //}
        public static void AddToCart(Models.TheCart cart, int productId, int quantity)
        {
  
                var cartItem = cart.CartItems.FirstOrDefault(ci => ci.BookID == productId);
                if (cartItem != null)
                {
                    // If the product is already in the cart, just update the quantity
                    cartItem.Quantity += quantity;
                }
                else
                {
                    // Add the new item to the cart
                    cart.CartItems.Add(new Models.CartItems { BookID = productId, Quantity = quantity });
                }
            

            // Depending on your setup, you might need to update the cart in your data store here
        }

    

        public static void RemoveFromCart(Models.TheCart cart, int productId)
        {
            var cartItem = cart.CartItems.FirstOrDefault(ci => ci.BookID == productId);

            if (cartItem != null)
            {
                cart.CartItems.Remove(cartItem);
            }
        }



        //public static async Task UpdateQty(int bookId, int qty)
        //{
        //    var book = await _context.Books.FirstOrDefaultAsync(b => b.BookID == bookId);
        //    if (book != null && Checkqty(bookId, qty))
        //    {
        //        book.StockQuantity -= qty;
        //        _context.Books.Update(book);
        //        await _context.SaveChangesAsync();
        //    }
        //}


        //public static async Task<bool>  Checkqty(int BookId, int qty)
        //{
        //    var book =  _context.Books.FirstOrDefaultAsync(b => b.BookID == BookId);
        //    return book != null && book.StockQuantity >= qty;
        //}

        public static void UpdateCartItemQuantity(Models.TheCart cart, int productId, int newQuantity)
        {
            var cartItem = cart.CartItems.FirstOrDefault(ci => ci.BookID == productId);
            if (cartItem != null)
            {
                if (newQuantity > 0)
                {
                    // Update the quantity of the existing item
                    cartItem.Quantity = newQuantity;
                }
                else
                {
                    // If the new quantity is zero or negative, remove the item from the cart
                    cart.CartItems.Remove(cartItem);
                }
            }
            else if (newQuantity > 0)
            {
                // If the item doesn't exist and the new quantity is positive, add the new item
                cart.CartItems.Add(new Models.CartItems { BookID = productId, Quantity = newQuantity });
            }
            // No action if the item doesn't exist and new quantity is zero or negative
        }


    }
}
