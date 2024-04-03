using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BookShop.Migrations
{
    /// <inheritdoc />
    public partial class CartItems : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "UserId",
                table: "Cartsitems",
                type: "nvarchar(450)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_Cartsitems_UserId",
                table: "Cartsitems",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Cartsitems_AspNetUsers_UserId",
                table: "Cartsitems",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Cartsitems_AspNetUsers_UserId",
                table: "Cartsitems");

            migrationBuilder.DropIndex(
                name: "IX_Cartsitems_UserId",
                table: "Cartsitems");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "Cartsitems");
        }
    }
}
